import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------- products
  async listProducts(user: { role: string; orgId?: string }, filters?: { status?: string; serviceLine?: string }) {
    const where: Record<string, unknown> = { deletedAt: null };
    // tenant isolation: internal roles see all, client roles only see own org
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'DESIGNER', 'SUPPORT'].includes(user.role)) {
      where.orgId = user.orgId ?? '__none__';
    }
    if (filters?.status) where.status = filters.status;
    if (filters?.serviceLine) where.serviceLine = filters.serviceLine;
    return this.prisma.product.findMany({
      where,
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProduct(user: { role: string; orgId?: string }, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: {
        organization: { select: { id: true, name: true } },
        stages: { orderBy: { enteredAt: 'asc' } },
        tasks: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 50 },
        designArtifacts: { orderBy: { createdAt: 'desc' } },
        deployments: { orderBy: { deployedAt: 'desc' }, take: 20 },
        tickets: { where: { status: { in: ['open', 'triaged', 'pending'] } } },
        quote: true,
        comments: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'DESIGNER', 'SUPPORT'].includes(user.role) && product.orgId !== user.orgId) {
      throw new ForbiddenException('Access denied to this product');
    }
    return product;
  }

  async createProduct(actor: { id: string; role: string; orgId?: string }, dto: {
    name: string;
    serviceLine: string;
    description?: string;
    orgId?: string;
  }) {
    const orgId = actor.role === 'CLIENT_OWNER' || actor.role === 'CLIENT_MEMBER' ? actor.orgId ?? '' : dto.orgId ?? actor.orgId ?? '';
    if (!orgId) throw new BadRequestException('Organization required');
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6);
    const product = await this.prisma.product.create({
      data: {
        orgId,
        name: dto.name,
        slug,
        serviceLine: dto.serviceLine as never,
        description: dto.description,
        status: 'REQUESTED',
        stages: { create: { stageName: 'requested' } },
      },
    });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId, action: 'product.created', target: `product:${product.id}` });
    await this.notifications.notifyOrg(orgId, {
      type: 'project',
      title: 'New product request',
      body: `"${dto.name}" (${dto.serviceLine}) was requested.`,
    });
    return product;
  }

  async updateStatus(actor: { id: string; role: string }, productId: string, status: string) {
    const product = await this.prisma.product.update({
      where: { id: productId },
      data: {
        status: status as never,
        stages: { create: { stageName: status.toLowerCase() } },
      },
      include: { stages: { orderBy: { enteredAt: 'asc' } } },
    });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId: product.orgId, action: 'product.status_changed', target: `product:${productId}`, details: { status } });
    await this.notifications.notifyOrg(product.orgId, {
      type: 'project',
      title: `Product moved to ${status.replace(/_/g, ' ').toLowerCase()}`,
      body: `"${product.name}" status updated.`,
    });
    return product;
  }

  async updateProduct(actor: { id: string; role: string }, productId: string, dto: { name?: string; description?: string; stagingUrl?: string; productionUrl?: string; monitorUrl?: string; monitorEnabled?: boolean; healthCheckPath?: string }) {
    const product = await this.prisma.product.update({ where: { id: productId }, data: dto });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId: product.orgId, action: 'product.updated', target: `product:${productId}` });
    return product;
  }

  async softDelete(actor: { id: string; role: string }, productId: string) {
    await this.prisma.product.update({ where: { id: productId }, data: { deletedAt: new Date() } });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, action: 'product.deleted', target: `product:${productId}` });
    return { deleted: true };
  }

  // -------------------------------------------------------------- quotes
  async createQuote(actor: { id: string; role: string }, productId: string, dto: {
    amount: number;
    currency?: string;
    breakdown?: { name: string; percent: number; amount: number }[];
    validUntil?: string;
  }) {
    if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.role)) throw new ForbiddenException('Only admins can create quotes');
    const quote = await this.prisma.quote.create({
      data: {
        productId,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        breakdown: dto.breakdown as never,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        status: 'sent',
      },
    });
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (product) {
      await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId: product.orgId, action: 'quote.created', target: `quote:${quote.id}` });
      await this.notifications.notifyOrg(product.orgId, {
        type: 'project',
        title: 'New quote available',
        body: `A quote of $${dto.amount} is ready for "${product.name}".`,
      });
    }
    return quote;
  }

  async approveQuote(actor: { id: string; role: string; orgId?: string }, quoteId: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id: quoteId }, include: { product: true } });
    if (!quote) throw new NotFoundException('Quote not found');
    if (actor.role === 'CLIENT_OWNER' && quote.product.orgId !== actor.orgId) throw new ForbiddenException();
    const updated = await this.prisma.quote.update({ where: { id: quoteId }, data: { status: 'approved', approvedAt: new Date() } });
    await this.prisma.productStage.create({ data: { productId: quote.productId, stageName: 'scoped' } });
    await this.prisma.product.update({ where: { id: quote.productId }, data: { status: 'SCOPED' } });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId: quote.product.orgId, action: 'quote.approved', target: `quote:${quoteId}` });
    return updated;
  }

  // --------------------------------------------------------- design review
  async addDesignArtifact(actor: { id: string; role: string }, productId: string, dto: { name: string; fileUrl: string }) {
    if (!['SUPER_ADMIN', 'ADMIN', 'DESIGNER'].includes(actor.role)) throw new ForbiddenException();
    return this.prisma.designArtifact.create({
      data: { productId, name: dto.name, fileUrl: dto.fileUrl },
    });
  }

  async reviewDesign(actor: { id: string; role: string; orgId?: string }, artifactId: string, approve: boolean, feedback?: string) {
    const artifact = await this.prisma.designArtifact.findUnique({ where: { id: artifactId }, include: { product: true } });
    if (!artifact) throw new NotFoundException('Design artifact not found');
    if (actor.role === 'CLIENT_OWNER' && artifact.product.orgId !== actor.orgId) throw new ForbiddenException();
    const updated = await this.prisma.designArtifact.update({
      where: { id: artifactId },
      data: {
        approvedById: approve ? actor.id : null,
        approvedAt: approve ? new Date() : null,
        rejected: !approve,
        feedback,
      },
    });
    await this.audit.log({
      actorType: 'USER', actorId: actor.id, orgId: artifact.product.orgId,
      action: approve ? 'design.approved' : 'design.rejected',
      target: `design:${artifactId}`, details: { feedback },
    });
    return updated;
  }

  // ------------------------------------------------------ collaboration
  // Comment threads per product (spec Section 3 item 6 — collaboration on the
  // same org-scoped data; owns the Comment table via ProjectsModule).
  async listComments(actor: { id: string; role: string; orgId?: string }, productId: string) {
    // tenant check reuses product access rules
    await this.getProduct(actor, productId);
    return this.prisma.comment.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      take: 100,
    });
  }

  async addComment(actor: { id: string; role: string; orgId?: string }, productId: string, body: string, designArtifactId?: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!product) throw new NotFoundException('Product not found');
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'DESIGNER', 'SUPPORT'].includes(actor.role) && product.orgId !== actor.orgId) {
      throw new ForbiddenException('Access denied to this product');
    }
    const comment = await this.prisma.comment.create({
      data: { productId, authorId: actor.id, body, designArtifactId },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId: product.orgId, action: 'comment.created', target: `product:${productId}` });
    return comment;
  }

  // Org-level team chat (owns the Message table via ProjectsModule).
  async listMessages(actor: { id: string; role: string; orgId?: string }) {
    if (!actor.orgId) return [];
    return this.prisma.message.findMany({
      where: { orgId: actor.orgId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true } } },
      take: 100,
    });
  }

  async sendMessage(actor: { id: string; role: string; orgId?: string }, body: string) {
    if (!actor.orgId) throw new BadRequestException('No organization in session');
    const message = await this.prisma.message.create({
      data: { orgId: actor.orgId, authorId: actor.id, body },
      include: { author: { select: { id: true, name: true } } },
    });
    return message;
  }

  // Shared project files (owns the ProjectFile table via ProjectsModule).
  async listFiles(actor: { id: string; role: string; orgId?: string }, productId?: string) {
    const where: Record<string, unknown> = {};
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'DESIGNER', 'SUPPORT'].includes(actor.role)) {
      where.orgId = actor.orgId ?? '__none__';
    }
    if (productId) where.productId = productId;
    return this.prisma.projectFile.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async addFile(actor: { id: string; role: string; orgId?: string }, dto: { productId?: string; name: string; fileUrl: string; sizeBytes: number; mimeType: string }) {
    const orgId = !['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'DESIGNER', 'SUPPORT'].includes(actor.role) ? actor.orgId ?? '' : actor.orgId ?? '';
    if (!orgId) throw new BadRequestException('Organization required');
    if (dto.productId) {
      const product = await this.prisma.product.findFirst({ where: { id: dto.productId, deletedAt: null } });
      if (!product) throw new NotFoundException('Product not found');
    }
    const file = await this.prisma.projectFile.create({
      data: {
        productId: dto.productId,
        orgId,
        name: dto.name,
        fileUrl: dto.fileUrl,
        sizeBytes: dto.sizeBytes,
        mimeType: dto.mimeType,
        uploadedById: actor.id,
      },
    });
    await this.audit.log({ actorType: 'USER', actorId: actor.id, orgId, action: 'file.uploaded', target: `file:${file.id}` });
    return file;
  }

  // ---------------------------------------------------------- deployments
  async recordDeployment(orgId: string, productId: string, dto: { environment: string; commitSha: string; commitMsg?: string; triggeredBy?: string }) {
    return this.prisma.deployment.create({
      data: { productId, environment: dto.environment, commitSha: dto.commitSha, commitMsg: dto.commitMsg, triggeredBy: dto.triggeredBy, status: 'pending' },
    });
  }

  async updateDeploymentStatus(deploymentId: string, status: string) {
    return this.prisma.deployment.update({ where: { id: deploymentId }, data: { status } });
  }
}
