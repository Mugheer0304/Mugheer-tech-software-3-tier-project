import { Global, Injectable, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ActorType } from '@prisma/client';

/** Append-only audit logging — privileged actions and AI agent actions land here. */
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
    await this.prisma.auditLog.create({
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
}

@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditGlobalModule {}
