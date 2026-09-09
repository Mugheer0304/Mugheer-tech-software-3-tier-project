import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { BillingService } from '../billing/billing.service';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private prisma: PrismaService,
    private billing: BillingService,
    private projects: ProjectsService,
  ) {}

  async processStripe(rawBody: string, signature: string | undefined, payload: Record<string, unknown>) {
    // Signature verification (idempotent processing below regardless of source)
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    if (secret && signature) {
      const expected = `t=${Math.floor(Date.now() / 1000)},v1=${crypto
        .createHmac('sha256', secret)
        .update(`${this.extractTimestamp(signature)}.${rawBody}`)
        .digest('hex')}`;
      if (!this.safeEqual(expected, signature)) {
        throw new BadRequestException('Invalid Stripe signature');
      }
    }
    const eventId = String(payload.id ?? crypto.randomUUID());
    const type = String(payload.type ?? 'unknown');
    const stored = await this.prisma.webhookEvent.create({
      data: { source: 'stripe', externalId: eventId, type, payload: payload as never },
    }).catch(() => null);
    if (!stored) {
      return { duplicate: true }; // unique constraint on externalId = idempotent
    }

    try {
      const data = ((payload as { data?: { object?: Record<string, unknown> } }).data?.object ?? {}) as Record<string, unknown>;
      switch (type) {
        case 'invoice.payment_succeeded':
          await this.prisma.invoice.updateMany({
            where: { stripeInvoiceId: String(data.id ?? '') },
            data: { status: 'PAID', paidAt: new Date() },
          });
          break;
        case 'invoice.payment_failed':
          await this.prisma.subscription.updateMany({
            where: { stripeSubscriptionId: String(data.subscription ?? '') },
            data: { status: 'PAST_DUE', dunningAttempts: { increment: 1 } },
          });
          break;
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.prisma.subscription.updateMany({
            where: { stripeSubscriptionId: String(data.id ?? '') },
            data: { status: String(data.status) === 'active' ? 'ACTIVE' : 'CANCELED' },
          });
          break;
        case 'checkout.session.completed':
          await this.prisma.invoice.updateMany({
            where: { organization: { billingCustomerId: String(data.customer ?? '') } },
            data: { status: 'PAID', paidAt: new Date() },
          });
          break;
        default:
          this.logger.log(`stripe webhook (unhandled): ${type}`);
      }
      await this.prisma.webhookEvent.update({ where: { id: stored.id }, data: { processedAt: new Date() } });
      return { ok: true };
    } catch (err) {
      await this.prisma.webhookEvent.update({ where: { id: stored.id }, data: { error: String(err) } });
      throw err;
    }
  }

  async processGithub(payload: Record<string, unknown>, signature: string | undefined, rawBody: string) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET ?? '';
    if (secret && signature) {
      const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
      if (!this.safeEqual(expected, signature)) throw new BadRequestException('Invalid GitHub signature');
    }
    const eventId = String(payload.after ?? crypto.randomUUID());
    await this.prisma.webhookEvent.create({
      data: { source: 'github', externalId: eventId, type: String(payload.action ?? 'push'), payload: payload as never },
    }).catch(() => null);

    const commit = String((payload.head_commit as { id?: string })?.id ?? '').slice(0, 12);
    const status = String((payload as { state?: string }).state ?? 'success');
    if (commit) {
      const deployment = await this.prisma.deployment.findFirst({ where: { commitSha: commit }, orderBy: { deployedAt: 'desc' } });
      if (deployment) {
        await this.prisma.deployment.update({ where: { id: deployment.id }, data: { status } });
      }
      void this.projects; // reserved for commit-to-task linking
    }
    return { ok: true };
  }

  private extractTimestamp(signature: string): string {
    return signature.split(',').find((p) => p.startsWith('t='))?.slice(2) ?? '';
  }

  private safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  }
}
