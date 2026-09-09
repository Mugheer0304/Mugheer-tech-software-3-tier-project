import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { Product } from '@prisma/client';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  /** Evaluate enabled threshold runbooks for a product against incoming points. */
  async evaluateRules(product: Product, points: { metricName: string; value: number }[]) {
    const runbooks = await this.prisma.automationRunbook.findMany({
      where: { productId: product.id, enabled: true, trigger: 'metric_threshold' },
    });
    for (const point of points) {
      const matching = runbooks.filter((r) => r.metricName === point.metricName && r.threshold !== null);
      for (const runbook of matching) {
        const breached = point.value > (runbook.threshold ?? Infinity);
        if (!breached) continue;
        const recent = await this.prisma.alert.findFirst({
          where: {
            productId: product.id,
            metricName: point.metricName,
            status: 'OPEN',
            createdAt: { gte: new Date(Date.now() - (runbook.durationSec ?? 300) * 1000) },
          },
        });
        if (recent) continue; // dedupe window
        await this.create(product, {
          severity: point.metricName === 'error_rate' || point.value > (runbook.threshold ?? 0) * 1.5 ? 'CRITICAL' : 'WARNING',
          message: `${point.metricName} = ${point.value} exceeded threshold ${runbook.threshold} (runbook: ${runbook.name})`,
          metricName: point.metricName,
          metricValue: point.value,
          aiConfidence: null,
        });
      }
    }
  }

  async create(product: Product, input: {
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    message: string;
    metricName?: string;
    metricValue?: number;
    aiConfidence?: number | null;
    aiRootCause?: string;
    aiRunbookId?: string;
  }) {
    const alert = await this.prisma.alert.create({
      data: {
        productId: product.id,
        severity: input.severity,
        message: input.message,
        metricName: input.metricName,
        metricValue: input.metricValue,
        aiConfidence: input.aiConfidence,
        aiRootCause: input.aiRootCause,
        aiRunbookId: input.aiRunbookId,
      },
    });
    this.logger.log(`alert created: ${alert.id} (${input.severity}) for product ${product.id}`);
    await this.notifications.notifyOrg(product.orgId, {
      type: 'alert',
      title: `${input.severity} alert: ${product.name}`,
      body: input.message,
    });
    return alert;
  }
}
