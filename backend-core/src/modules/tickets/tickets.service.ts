import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiService } from '../ai/ai.service';
import * as crypto from 'crypto';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private ai: AiService,
  ) {}

  async list(user: { role: string; orgId?: string }, filters: { status?: string; productId?: string }) {
    const where: Record<string, unknown> = {};
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'SUPPORT'].includes(user.role)) {
      where.orgId = user.orgId ?? '__none__';
    }
    if (filters.status) where.status = filters.status;
    if (filters.productId) where.productId = filters.productId;
    return this.prisma.ticket.findMany({
      where,
      include: { product: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async create(actor: { id: string; role: string; orgId?: string }, dto: { productId?: string; subject: string; body: string; category?: string; priority?: string }) {
    const ticket = await this.prisma.ticket.create({
      data: {
        productId: dto.productId,
        orgId: actor.orgId ?? '',
        subject: dto.subject,
        category: dto.category ?? 'general',
        priority: dto.priority ?? 'normal',
        status: 'open',
      },
    });
    await this.prisma.ticketMessage.create({
      data: { ticketId: ticket.id, authorId: actor.id, body: dto.body },
    });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId: ticket.orgId, action: 'ticket.created', target: `ticket:${ticket.id}` });
    // AI triage: classify + draft a first reply (draft only — a human approves before it's sent)
    void this.ai.triage(ticket.id, dto.subject, dto.body)
      .then(async (result) => {
        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: { category: result.category, priority: result.priority, aiSuggestedReply: result.draftReply, aiCategoryConfidence: result.confidence },
        });
        await this.prisma.ticketMessage.create({
          data: { ticketId: ticket.id, authorType: 'AI_AGENT', body: result.draftReply, isAiDraft: true },
        });
      })
      .catch(() => undefined);
    return ticket;
  }

  async get(user: { role: string; orgId?: string }, ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true } } } }, product: { select: { id: true, name: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'SUPPORT'].includes(user.role) && ticket.orgId !== user.orgId) {
      throw new ForbiddenException();
    }
    return ticket;
  }

  async reply(actor: { id: string; role: string; orgId?: string }, ticketId: string, body: string, opts?: { isAiDraft?: boolean }) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'SUPPORT'].includes(actor.role) && ticket.orgId !== actor.orgId) {
      throw new ForbiddenException();
    }
    const message = await this.prisma.ticketMessage.create({
      data: { ticketId, authorId: actor.id, authorType: 'USER', body, isAiDraft: opts?.isAiDraft ?? false },
    });
    if (opts?.isAiDraft) {
      // Human approval of an AI draft — record it in AI governance log
      await this.prisma.aiActionLog.updateMany({
        where: { feature: 'support_triage', orgId: ticket.orgId, humanApproved: false },
        data: { humanApproved: true, approvedById: actor.id },
      });
    }
    if (ticket.status === 'open') {
      await this.prisma.ticket.update({ where: { id: ticketId }, data: { status: 'pending' } });
    }
    await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId: ticket.orgId, action: 'ticket.reply', target: `ticket:${ticketId}` });
    await this.notifications.notifyOrg(ticket.orgId, { type: 'ticket', title: `New reply on ticket`, body: ticket.subject });
    return message;
  }

  async updateStatus(actor: { id: string; role: string }, ticketId: string, status: string) {
    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status, resolvedAt: status === 'resolved' ? new Date() : null },
    });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId: ticket.orgId, action: 'ticket.status_changed', target: `ticket:${ticketId}`, details: { status } });
    return ticket;
  }
}
