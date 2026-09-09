import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';

@Injectable()
export class OrgsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async get(orgId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      include: { members: { include: { user: { select: { id: true, email: true, name: true, role: true } } } } },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(requester: { id: string; role: string; orgId?: string }, orgId: string, dto: { name?: string; taxRate?: number; taxRegion?: string }) {
    if (requester.role !== 'SUPER_ADMIN' && requester.role !== 'ADMIN' && requester.role !== 'CLIENT_OWNER') {
      throw new ForbiddenException();
    }
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: { name: dto.name, taxRate: dto.taxRate, taxRegion: dto.taxRegion },
    });
    await this.audit.log({ actorType: 'USER', actorId: requester.id, orgId, action: 'org.updated', target: `org:${orgId}` });
    return org;
  }
}
