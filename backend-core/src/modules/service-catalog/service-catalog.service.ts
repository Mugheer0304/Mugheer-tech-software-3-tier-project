import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';

export interface CatalogEntryDto {
  id: string;
  slug: string;
  serviceLine: string;
  name: string;
  summary: string;
  description: string;
  icon: string;
  startingPrice: number;
  currency: string;
  includes: string[] | null;
  timelineWeeks: number | null;
  statusPipeline: string[] | null;
  isMostRequested: boolean;
  isActive: boolean;
  sortOrder: number;
}

@Injectable()
export class ServiceCatalogService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /** Public: drives the Service Box UI on the landing page and client dashboard. */
  async listActive(): Promise<CatalogEntryDto[]> {
    const rows = await this.prisma.serviceLineCatalog.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      serviceLine: r.serviceLine,
      name: r.name,
      summary: r.summary,
      description: r.description,
      icon: r.icon,
      startingPrice: r.startingPrice,
      currency: r.currency,
      includes: (r.includes as string[] | null) ?? null,
      timelineWeeks: r.timelineWeeks,
      statusPipeline: (r.statusPipeline as string[] | null) ?? null,
      isMostRequested: r.isMostRequested,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
    }));
  }

  /** Public: full detail for a single Service Box detail view. */
  async getBySlug(slug: string): Promise<CatalogEntryDto> {
    const r = await this.prisma.serviceLineCatalog.findUnique({ where: { slug } });
    if (!r || !r.isActive || r.deletedAt) throw new NotFoundException(`Service '${slug}' not found`);
    return {
      id: r.id,
      slug: r.slug,
      serviceLine: r.serviceLine,
      name: r.name,
      summary: r.summary,
      description: r.description,
      icon: r.icon,
      startingPrice: r.startingPrice,
      currency: r.currency,
      includes: (r.includes as string[] | null) ?? null,
      timelineWeeks: r.timelineWeeks,
      statusPipeline: (r.statusPipeline as string[] | null) ?? null,
      isMostRequested: r.isMostRequested,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
    };
  }

  /** Internal: admin console lists everything, including inactive entries. */
  async listAll() {
    return this.prisma.serviceLineCatalog.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async update(actor: { id: string; role: string }, slug: string, dto: Partial<{
    name: string;
    summary: string;
    description: string;
    icon: string;
    startingPrice: number;
    currency: string;
    includes: string[];
    timelineWeeks: number;
    statusPipeline: string[];
    isMostRequested: boolean;
    isActive: boolean;
    sortOrder: number;
  }>) {
    const existing = await this.prisma.serviceLineCatalog.findUnique({ where: { slug } });
    if (!existing) throw new NotFoundException(`Service '${slug}' not found`);
    const updated = await this.prisma.serviceLineCatalog.update({
      where: { slug },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.summary !== undefined && { summary: dto.summary }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.startingPrice !== undefined && { startingPrice: dto.startingPrice }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.includes !== undefined && { includes: dto.includes as never }),
        ...(dto.timelineWeeks !== undefined && { timelineWeeks: dto.timelineWeeks }),
        ...(dto.statusPipeline !== undefined && { statusPipeline: dto.statusPipeline as never }),
        ...(dto.isMostRequested !== undefined && { isMostRequested: dto.isMostRequested }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
    await this.audit.log({
      actorType: 'USER',
      actorId: actor.id,
      action: 'service_catalog.updated',
      target: `service_line:${slug}`,
      details: { fields: Object.keys(dto) },
    });
    return updated;
  }
}
