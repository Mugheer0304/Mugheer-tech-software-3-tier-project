import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { StripeService } from './stripe.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../../common/audit.service';
import { config } from '../../common/config';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  // -------------------------------------------------------------- invoices
  async createInvoice(actor: { id: string; role: string }, dto: { orgId: string; amount: number; currency?: string; dueDate?: string; lineItems: { description: string; quantity: number; unitPrice: number }[] }) {
    if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.role)) throw new ForbiddenException('Only admins can create invoices');
    const org = await this.prisma.organization.findUnique({ where: { id: dto.orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    const taxAmount = (dto.amount * (org.taxRate ?? 0)) / 100;
    const number = `INV-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const invoice = await this.prisma.invoice.create({
      data: {
        number,
        orgId: dto.orgId,
        amount: dto.amount,
        taxAmount,
        currency: dto.currency ?? 'USD',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        lineItems: dto.lineItems as never,
        status: 'SENT',
      },
    });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId: dto.orgId, action: 'invoice.created', target: `invoice:${invoice.id}`, details: { amount: dto.amount } });
    await this.notifications.notifyOrg(dto.orgId, {
      type: 'invoice',
      title: `New invoice ${number}`,
      body: `An invoice of $${(dto.amount + taxAmount).toFixed(2)} is available.`,
    });
    return invoice;
  }

  async listInvoices(user: { role: string; orgId?: string }) {
    const where = ['SUPER_ADMIN', 'ADMIN'].includes(user.role) ? {} : { orgId: user.orgId ?? '__none__' };
    return this.prisma.invoice.findMany({ where, orderBy: { createdAt: 'desc' }, include: { payments: true } });
  }

  async getInvoice(user: { role: string; orgId?: string }, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true, organization: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role) && invoice.orgId !== user.orgId) {
      throw new ForbiddenException();
    }
    return invoice;
  }

  /** Simulated payment (card data never touches our servers; real flow uses Stripe Checkout). */
  async payInvoice(user: { id: string; role: string; orgId?: string }, invoiceId: string) {
    const invoice = await this.getInvoice(user, invoiceId);
    if (invoice.status === 'PAID') throw new BadRequestException('Invoice already paid');
    const total = invoice.amount + invoice.taxAmount;
    let providerRef = `mock_${Date.now()}`;
    if (this.stripe.enabled && invoice.organization.billingCustomerId) {
      // Real implementation: create a Stripe PaymentIntent and return client_secret.
      providerRef = `pi_mock_${Date.now()}`;
    }
    const payment = await this.prisma.payment.create({
      data: { invoiceId, amount: total, method: 'stripe', providerRef, status: 'succeeded' },
    });
    await this.prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'PAID', paidAt: new Date() } });
    await this.audit.log({ actorType: 'USER', actorId: user.id, orgId: invoice.orgId, action: 'invoice.paid', target: `invoice:${invoiceId}`, details: { amount: total } });
    await this.notifications.notifyOrg(invoice.orgId, { type: 'invoice', title: `Payment received`, body: `Invoice ${invoice.number} was paid ($${total.toFixed(2)}).` });
    return payment;
  }

  // ---------------------------------------------------------- subscriptions
  async subscribe(actor: { id: string; role: string; orgId?: string }, planId: string) {
    const plan = await this.prisma.pricingPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    let stripeSubscriptionId: string | null = null;
    if (this.stripe.enabled) {
      // Real flow: create Stripe Checkout session for subscription mode.
      stripeSubscriptionId = `sub_mock_${Date.now()}`;
    }
    const sub = await this.prisma.subscription.create({
      data: {
        orgId: actor.orgId ?? '',
        planId,
        status: 'ACTIVE',
        stripeSubscriptionId,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId: actor.orgId, action: 'subscription.created', target: `subscription:${sub.id}` });
    return sub;
  }

  async cancelSubscription(actor: { id: string; role: string; orgId?: string }, subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.role) && sub.orgId !== actor.orgId) throw new ForbiddenException();
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELED', cancelAtPeriodEnd: true },
    });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId: sub.orgId, action: 'subscription.canceled', target: `subscription:${subscriptionId}` });
    return updated;
  }

  async listPlans() {
    return this.prisma.pricingPlan.findMany({ where: { active: true }, orderBy: { basePrice: 'asc' } });
  }

  async listSubscriptions(user: { role: string; orgId?: string }) {
    const where = ['SUPER_ADMIN', 'ADMIN'].includes(user.role) ? {} : { orgId: user.orgId ?? '__none__' };
    return this.prisma.subscription.findMany({ where, include: { plan: true }, orderBy: { createdAt: 'desc' } });
  }

  // ---------------------------------------------------------------- refunds
  async refund(actor: { id: string; role: string }, invoiceId: string, amount: number) {
    if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.role)) throw new ForbiddenException('Only admins can refund');
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.status !== 'PAID') throw new BadRequestException('Invoice not refundable');
    const total = invoice.amount + invoice.taxAmount;
    const newRefunded = invoice.refundedAmount + amount;
    if (newRefunded > total) throw new BadRequestException('Refund exceeds paid amount');
    const status = newRefunded >= total ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    await this.prisma.invoice.update({ where: { id: invoiceId }, data: { refundedAmount: newRefunded, refundedAt: new Date(), status: status as never } });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId: invoice.orgId, action: 'invoice.refunded', target: `invoice:${invoiceId}`, details: { amount, total } });
    await this.notifications.notifyOrg(invoice.orgId, { type: 'invoice', title: 'Refund processed', body: `$${amount.toFixed(2)} was refunded on invoice ${invoice.number}.` });
    return { refunded: amount, status };
  }

  // -------------------------------------------------------------- metering
  async recordUsage(orgId: string, metric: string, quantity: number) {
    const record = await this.prisma.usageRecord.create({ data: { orgId, metric, quantity } });
    void this.reportToStripe(record.id).catch(() => undefined);
    return record;
  }

  private async reportToStripe(recordId: string) {
    if (!this.stripe.enabled) return;
    await this.prisma.usageRecord.update({ where: { id: recordId }, data: { reportedToStripe: true } });
  }

  // --------------------------------------------------------------- dunning
  async runDunningPass() {
    const due = await this.prisma.subscription.findMany({
      where: { status: 'PAST_DUE', dunningAttempts: { lt: 4 } },
      include: { plan: true, organization: true },
    });
    for (const sub of due) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { dunningAttempts: { increment: 1 }, lastDunningAt: new Date() },
      });
      await this.notifications.notifyOrg(sub.orgId, {
        type: 'invoice',
        title: 'Payment failed — action needed',
        body: `We couldn't charge your ${sub.plan.name} subscription. Please update your payment method to avoid service interruption.`,
      });
    }
    return { processed: due.length };
  }
}
