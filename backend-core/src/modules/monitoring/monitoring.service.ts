import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AlertsService } from './alerts.service';
import { config } from '../../common/config';

@Injectable()
export class MonitoringService {
  constructor(
    private prisma: PrismaService,
    private alerts: AlertsService,
  ) {}

  async ingest(orgId: string, productId: string, points: { metricName: string; value: number; timestamp?: string }[]) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.orgId !== orgId) throw new ForbiddenException('Product belongs to another organization');
    const rows = points.map((p) => ({
      productId,
      metricName: p.metricName,
      value: p.value,
      timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
    }));
    await this.prisma.monitoringMetric.createMany({ data: rows });
    // evaluate alert rules + anomaly check (delegated to AI service via worker normally)
    await this.alerts.evaluateRules(product, points);
    return { ingested: rows.length };
  }

  async ingestBatchInternal(points: { productId: string; metricName: string; value: number; timestamp?: string }[]) {
    await this.prisma.monitoringMetric.createMany({
      data: points.map((p) => ({ ...p, timestamp: p.timestamp ? new Date(p.timestamp) : new Date() })),
    });
    return { ingested: points.length };
  }

  /** Called by the worker (uptime probes) and AI services (anomalies) via internal token. */
  async createAlertInternal(dto: {
    productId: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    message: string;
    metricName?: string;
    metricValue?: number;
    aiConfidence?: number | null;
  }) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) return { skipped: 'product not found' };
    return this.alerts.create(product, dto);
  }

  async latest(orgId: string, productId: string, metricName: string) {
    const metric = await this.prisma.monitoringMetric.findFirst({
      where: { productId, metricName },
      orderBy: { timestamp: 'desc' },
    });
    if (!metric) return { value: null, timestamp: null };
    return { value: metric.value, timestamp: metric.timestamp };
  }

  async series(user: { role: string; orgId?: string }, productId: string, metricName: string, from?: string, to?: string) {
    await this.assertAccess(user, productId);
    const range = {
      ...(from ? { gte: new Date(from) } : { gte: new Date(Date.now() - 24 * 3600 * 1000) }),
      ...(to ? { lte: new Date(to) } : {}),
    };
    const rows = await this.prisma.monitoringMetric.findMany({
      where: { productId, metricName, timestamp: range },
      orderBy: { timestamp: 'asc' },
      take: 5000,
    });
    return rows.map((r) => ({ t: r.timestamp, v: r.value }));
  }

  async dashboard(user: { role: string; orgId?: string }, productId: string) {
    await this.assertAccess(user, productId);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const metrics = ['response_time_ms', 'error_rate', 'cpu_percent', 'uptime'];
    const panels = await Promise.all(
      metrics.map(async (metricName) => {
        const rows = await this.prisma.monitoringMetric.findMany({
          where: { productId, metricName, timestamp: { gte: since } },
          orderBy: { timestamp: 'asc' },
          take: 2000,
        });
        const values = rows.map((r) => r.value);
        return {
          metricName,
          count: values.length,
          avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
          max: values.length ? Math.max(...values) : 0,
          min: values.length ? Math.min(...values) : 0,
          last: values.length ? values[values.length - 1] : null,
          points: rows.map((r) => ({ t: r.timestamp, v: r.value })).slice(-300),
        };
      }),
    );
    const openAlerts = await this.prisma.alert.count({ where: { productId, status: 'OPEN' } });
    const uptimePoints = await this.prisma.monitoringMetric.findMany({
      where: { productId, metricName: 'uptime', timestamp: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
      orderBy: { timestamp: 'asc' },
    });
    const uptime30d = uptimePoints.length
      ? uptimePoints.reduce((a, b) => a + b.value, 0) / uptimePoints.length
      : null;
    const insights = await this.prisma.aiInsight.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
    return { product: { id: product.id, name: product.name, status: product.status, productionUrl: product.productionUrl }, panels, openAlerts, uptime30d, aiInsight: insights?.summary ?? null };
  }

  async listAlerts(user: { role: string; orgId?: string }, filters: { status?: string; productId?: string }) {
    const where: Record<string, unknown> = {};
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'SUPPORT'].includes(user.role)) {
      where.product = { orgId: user.orgId ?? '__none__' };
    }
    if (filters.status) where.status = filters.status;
    if (filters.productId) where.productId = filters.productId;
    return this.prisma.alert.findMany({
      where,
      include: { product: { select: { id: true, name: true, orgId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async acknowledge(user: { id: string; role: string }, alertId: string) {
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { status: 'ACKNOWLEDGED', acknowledgedById: user.id, acknowledgedAt: new Date() },
    });
  }

  async resolve(user: { id: string; role: string }, alertId: string) {
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }

  async grafanaEmbedUrl(user: { role: string; orgId?: string }, productId: string) {
    await this.assertAccess(user, productId);
    // In production, generate a signed Grafana renderer URL scoped to this product's datasource.
    return { url: `${config.monitoring.grafanaUrl}/d/product-overview?var-product=${productId}&kiosk` };
  }

  private async assertAccess(user: { role: string; orgId?: string }, productId: string) {
    if (['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'SUPPORT'].includes(user.role)) return;
    const product = await this.prisma.product.findFirst({ where: { id: productId } });
    if (!product || product.orgId !== user.orgId) throw new ForbiddenException('No access to this product');
  }
}
