import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ActorType } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(entry: {
    actorType: ActorType;
    actorId?: string;
    orgId?: string;
    action: string;
    target?: string;
    details?: Record<string, unknown>;
    ip?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorType: entry.actorType,
        actorId: entry.actorId,
        orgId: entry.orgId,
        action: entry.action,
        target: entry.target,
        details: entry.details as never,
        ip: entry.ip,
      },
    });
  }

  async list(user: { role: string; orgId?: string }, filters: { actorType?: string; action?: string; cursor?: string; limit?: number }) {
    const where: Record<string, unknown> = {};
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      where.orgId = user.orgId ?? '__none__';
    }
    if (filters.actorType) where.actorType = filters.actorType;
    if (filters.action) where.action = { contains: filters.action };
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.limit ?? 50, 200),
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
  }
}
