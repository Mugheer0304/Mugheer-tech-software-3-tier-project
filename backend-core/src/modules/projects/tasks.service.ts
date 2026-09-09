import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(user: { role: string; orgId?: string; id: string }, filters: { productId?: string; assigneeId?: string; sprintId?: string; status?: string; mine?: boolean }) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (filters.productId) where.productId = filters.productId;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.sprintId) where.sprintId = filters.sprintId;
    if (filters.status) where.status = filters.status;
    if (filters.mine) where.assigneeId = user.id;

    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'DESIGNER', 'SUPPORT'].includes(user.role)) {
      // client-side users see only tasks of their org's products
      where.product = { orgId: user.orgId ?? '__none__' };
    }
    return this.prisma.task.findMany({
      where,
      include: { product: { select: { id: true, name: true, status: true } }, assignee: { select: { id: true, name: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(actor: { id: string; role: string }, dto: { productId: string; title: string; description?: string; assigneeId?: string; priority?: string; storyPoints?: number; sprintId?: string }) {
    const task = await this.prisma.task.create({
      data: {
        productId: dto.productId,
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId,
        creatorId: actor.id,
        priority: (dto.priority as never) ?? 'MEDIUM',
        storyPoints: dto.storyPoints,
        sprintId: dto.sprintId,
        status: 'TODO',
      },
    });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, action: 'task.created', target: `task:${task.id}` });
    return task;
  }

  async update(actor: { id: string; role: string }, taskId: string, dto: { title?: string; description?: string; status?: string; priority?: string; assigneeId?: string | null; sprintId?: string | null; gitBranch?: string; gitPrUrl?: string; storyPoints?: number }) {
    const existing = await this.prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Task not found');
    const task = await this.prisma.task.update({ where: { id: taskId }, data: { ...dto, status: dto.status as never, priority: dto.priority as never } });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, action: 'task.updated', target: `task:${taskId}`, details: { status: dto.status } });
    return task;
  }

  async softDelete(actor: { id: string; role: string }, taskId: string) {
    await this.prisma.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, action: 'task.deleted', target: `task:${taskId}` });
    return { deleted: true };
  }
}
