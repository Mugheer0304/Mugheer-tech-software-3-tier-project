import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma } from '@prisma/client';

type Runbook = Prisma.AutomationRunbookGetPayload<{}>;

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async listRunbooks(user: { role: string; orgId?: string }, productId?: string) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER'].includes(user.role)) {
      where.product = { orgId: user.orgId ?? '__none__' };
    }
    if (productId) where.productId = productId;
    return this.prisma.automationRunbook.findMany({ where, include: { product: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async createRunbook(actor: { id: string; role: string }, dto: {
    productId?: string;
    name: string;
    description?: string;
    trigger: string;
    condition?: string;
    metricName?: string;
    threshold?: number;
    durationSec?: number;
    action: string;
    actionConfig?: Record<string, unknown>;
  }) {
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER'].includes(actor.role)) throw new ForbiddenException();
    const runbook = await this.prisma.automationRunbook.create({
      data: {
        productId: dto.productId,
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger,
        condition: dto.condition,
        metricName: dto.metricName,
        threshold: dto.threshold,
        durationSec: dto.durationSec ?? 300,
        action: dto.action as never,
        actionConfig: (dto.actionConfig ?? {}) as never,
      },
    });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, action: 'runbook.created', target: `runbook:${runbook.id}`, details: { name: dto.name } });
    return runbook;
  }

  async updateRunbook(actor: { id: string; role: string }, id: string, dto: Partial<{
    name: string; description: string; enabled: boolean; threshold: number; durationSec: number; condition: string; actionConfig: Record<string, unknown>;
  }>) {
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER'].includes(actor.role)) throw new ForbiddenException();
    const runbook = await this.prisma.automationRunbook.update({ where: { id }, data: { ...dto, actionConfig: dto.actionConfig as never } });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, action: 'runbook.updated', target: `runbook:${id}`, details: { enabled: dto.enabled } });
    return runbook;
  }

  async deleteRunbook(actor: { id: string; role: string }, id: string) {
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER'].includes(actor.role)) throw new ForbiddenException();
    await this.prisma.automationRunbook.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, action: 'runbook.deleted', target: `runbook:${id}` });
    return { deleted: true };
  }

  /**
   * Execute a runbook action. Bounded by maxRetries — automation never loops
   * unbounded against a live system (kill-switch = set enabled=false).
   */
  async execute(runbookId: string, triggeredBy: 'USER' | 'AI_AGENT' | 'SYSTEM' = 'SYSTEM', context?: Record<string, unknown>) {
    const runbook = await this.prisma.automationRunbook.findFirst({ where: { id: runbookId, deletedAt: null, enabled: true } });
    if (!runbook) throw new NotFoundException('Runbook not found or disabled');
    if (runbook.runCount >= runbook.maxRetries && triggeredBy !== 'USER') {
      throw new BadRequestException(`Runbook hit bounded retry limit (${runbook.maxRetries}) — escalate to human`);
    }

    let result: string;
    switch (runbook.action) {
      case 'OPEN_TICKET':
        result = await this.actionOpenTicket(runbook, context);
        break;
      case 'SEND_EMAIL':
        result = await this.actionNotify(runbook, 'email');
        break;
      case 'SEND_SLACK':
        result = await this.actionNotify(runbook, 'slack');
        break;
      case 'RESTART_SERVICE':
        result = await this.actionRestart(runbook);
        break;
      case 'SCALE_UP':
      case 'SCALE_DOWN':
        result = await this.actionScale(runbook);
        break;
      case 'GENERATE_REPORT':
        result = await this.actionReport(runbook);
        break;
      case 'WEBHOOK':
        result = await this.actionWebhook(runbook);
        break;
      default:
        result = 'no-op';
    }

    await this.prisma.automationRunbook.update({
      where: { id: runbook.id },
      data: { lastRunAt: new Date(), runCount: { increment: 1 } },
    });
    await this.audit.log({
      actorType: triggeredBy === 'AI_AGENT' ? 'AI_AGENT' : 'SYSTEM',
      action: 'runbook.execute',
      target: `runbook:${runbook.id}`,
      details: { action: runbook.action, result },
    });
    return { runbookId: runbook.id, action: runbook.action, result };
  }

  // --------------------------------------------------------------- actions
  private async actionOpenTicket(runbook: Runbook, context?: Record<string, unknown>) {
    if (!runbook.productId) return 'skipped: no product bound';
    const product = await this.prisma.product.findUnique({ where: { id: runbook.productId } });
    if (!product) return 'skipped: product missing';
    const ticket = await this.prisma.ticket.create({
      data: {
        productId: product.id,
        orgId: product.orgId,
        subject: `[Automated] ${runbook.name}`,
        category: 'bug',
        priority: 'high',
        status: 'open',
      },
    });
    await this.notifications.notifyOrg(product.orgId, {
      type: 'ticket',
      title: 'Automated ticket opened',
      body: `Runbook "${runbook.name}" opened ticket for ${product.name}.`,
    });
    return `ticket:${ticket.id}`;
  }

  private async actionNotify(runbook: Runbook, channel: 'email' | 'slack') {
    if (!runbook.productId) return 'skipped: no product bound';
    const product = await this.prisma.product.findUnique({ where: { id: runbook.productId } });
    if (!product) return 'skipped: product missing';
    await this.notifications.notifyOrg(product.orgId, {
      type: 'alert',
      title: `Automation: ${runbook.name}`,
      body: `Action ${runbook.action} triggered via ${channel}. Condition: ${runbook.condition ?? 'n/a'}`,
    });
    return `notified:${channel}`;
  }

  private async actionRestart(runbook: Runbook) {
    // Real implementation: Kubernetes API rollout restart for the product's workload.
    this.logger.log(`restart requested for product ${runbook.productId}`);
    return 'restart:dispatched';
  }

  private async actionScale(runbook: Runbook) {
    this.logger.log(`scale ${runbook.action} requested for product ${runbook.productId}`);
    return `${runbook.action.toLowerCase()}:dispatched`;
  }

  private async actionReport(runbook: Runbook) {
    if (!runbook.productId) return 'skipped: no product bound';
    return `report:queued:${runbook.productId}`;
  }

  private async actionWebhook(runbook: Runbook) {
    const cfg = (runbook.actionConfig ?? {}) as { url?: string };
    if (!cfg.url) return 'skipped: no webhook url';
    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runbook: runbook.name, action: runbook.action, at: new Date().toISOString() }),
        signal: AbortSignal.timeout(5000),
      });
      return `webhook:${res.status}`;
    } catch (err) {
      return `webhook:failed:${String(err)}`;
    }
  }
}
