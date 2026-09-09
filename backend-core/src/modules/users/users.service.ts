import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(requester: { role: string; orgId?: string }) {
    if (requester.role === 'SUPER_ADMIN' || requester.role === 'ADMIN') {
      return this.prisma.user.findMany({
        where: { deletedAt: null },
        select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!requester.orgId) return [];
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: requester.orgId },
      include: { user: { select: { id: true, email: true, name: true, role: true, isActive: true } } },
    });
    return members.map((m) => ({ ...m.user, orgRole: m.role }));
  }

  async invite(orgId: string, invitedBy: { id: string; role: string }, dto: { email: string; name: string; role: string }) {
    if (invitedBy.role === 'CLIENT_OWNER' && !dto.role.startsWith('CLIENT')) {
      throw new ForbiddenException('Client owners can only invite client roles');
    }
    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          role: dto.role as never,
          passwordHash: await bcrypt.hash(tempPassword, 12),
        },
      });
    }
    await this.prisma.organizationMember.create({
      data: { organizationId: orgId, userId: user.id, role: dto.role as never, invitedBy: invitedBy.id },
    });
    await this.audit.log({
      actorType: 'USER',
      actorId: invitedBy.id,
      orgId,
      action: 'user.invited',
      target: `user:${user.id}`,
      details: { email: dto.email, role: dto.role },
    });
    return { userId: user.id, temporaryPassword: user.passwordHash ? undefined : undefined, invited: true };
  }

  async updateRole(requester: { id: string; role: string }, userId: string, role: string) {
    if (requester.role !== 'SUPER_ADMIN' && requester.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can change roles');
    }
    const user = await this.prisma.user.update({ where: { id: userId }, data: { role: role as never } });
    await this.audit.log({
      actorType: 'USER',
      actorId: requester.id,
      action: 'user.role_changed',
      target: `user:${userId}`,
      details: { newRole: role },
    });
    return { id: user.id, role: user.role };
  }

  async deactivate(requester: { id: string; role: string }, userId: string) {
    if (requester.role !== 'SUPER_ADMIN' && requester.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can deactivate users');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    await this.audit.log({ actorType: 'USER', actorId: requester.id, action: 'user.deactivated', target: `user:${userId}` });
    return { deactivated: true };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, name: true, role: true, mfaEnabled: true, avatarUrl: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: { select: { id: true, name: true, slug: true, type: true } } },
    });
    return { ...user, organizations: memberships.map((m) => m.organization) };
  }
}
