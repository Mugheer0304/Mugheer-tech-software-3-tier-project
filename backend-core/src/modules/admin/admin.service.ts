import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async stats() {
    const [users, orgs, products, openAlerts, openTickets, mrrCents] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.organization.count({ where: { deletedAt: null, type: 'CLIENT' } }),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.alert.count({ where: { status: 'OPEN' } }),
      this.prisma.ticket.count({ where: { status: { in: ['open', 'triaged', 'pending'] } } }),
      this.prisma.$queryRaw<Array<{ total: bigint | null }>>`
        SELECT COALESCE(SUM(p."basePrice"), 0)::bigint AS total
        FROM "Subscription" s
        JOIN "PricingPlan" p ON p.id = s."planId"
        WHERE s.status = 'ACTIVE'
      `,
    ]);
    return {
      users,
      clientOrgs: orgs,
      products,
      openAlerts,
      openTickets,
      monthlyRecurringRevenue: Number(mrrCents[0]?.total ?? 0),
    };
  }

  async setPricing(actor: { id: string; role: string }, dto: {
    serviceLine: string;
    name: string;
    description: string;
    pricingModel: string;
    basePrice: number;
    stripePriceId?: string;
  }) {
    if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenException('Only super admins set pricing');
    const plan = await this.prisma.pricingPlan.upsert({
      where: { id: dto.serviceLine },
      create: {
        serviceLine: dto.serviceLine as never,
        name: dto.name,
        description: dto.description,
        pricingModel: dto.pricingModel as never,
        basePrice: dto.basePrice,
        stripePriceId: dto.stripePriceId,
      },
      update: { name: dto.name, description: dto.description, basePrice: dto.basePrice, stripePriceId: dto.stripePriceId },
    });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, action: 'pricing.updated', target: `plan:${plan.id}`, details: { serviceLine: dto.serviceLine, basePrice: dto.basePrice } });
    return plan;
  }

  async listPricing() {
    return this.prisma.pricingPlan.findMany({ orderBy: { serviceLine: 'asc' } });
  }
}
