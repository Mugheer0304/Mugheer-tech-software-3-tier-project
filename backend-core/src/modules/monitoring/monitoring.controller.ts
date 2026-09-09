import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { Roles, Public } from '../../common/decorators/roles.decorator';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';

interface AuthedRequest extends Request {
  user: { id: string; role: string; orgId?: string | null };
}

/** Adapter: services expect orgId as string|undefined. */
const principal = (u: AuthedRequest['user']) => ({ ...u, orgId: u.orgId ?? undefined });

@Controller('monitoring')
export class MonitoringController {
  constructor(private monitoring: MonitoringService) {}

  /** Monitoring dashboard data for a product (tenant-scoped). */
  @Get('products/:id/dashboard')
  dashboard(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.monitoring.dashboard(principal(req.user), id);
  }

  @Get('products/:id/series')
  series(@Req() req: AuthedRequest, @Param('id') id: string, @Query() q: { metric?: string; from?: string; to?: string }) {
    return this.monitoring.series(principal(req.user), id, q.metric ?? 'response_time_ms', q.from, q.to);
  }

  @Get('products/:id/grafana')
  grafana(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.monitoring.grafanaEmbedUrl(principal(req.user), id);
  }

  @Get('alerts')
  alerts(@Req() req: AuthedRequest, @Query() q: { status?: string; productId?: string }) {
    return this.monitoring.listAlerts(principal(req.user), q);
  }

  @Post('alerts/:id/acknowledge')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'SUPPORT')
  acknowledge(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.monitoring.acknowledge(req.user, id);
  }

  @Post('alerts/:id/resolve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'SUPPORT')
  resolve(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.monitoring.resolve(req.user, id);
  }

  /** Ingestion for client systems (tenant derived from the authenticated principal). */
  @Post('ingest')
  ingest(@Req() req: AuthedRequest, @Body() dto: { productId: string; points: { metricName: string; value: number; timestamp?: string }[] }) {
    return this.monitoring.ingest(req.user.orgId ?? '', dto.productId, dto.points);
  }

  /**
   * Internal batch ingestion (worker pushes uptime probes / aggregated metrics).
   * Public bypasses the JWT guard; InternalServiceGuard enforces the shared
   * service token instead (server-to-server, never browser-facing).
   */
  @Public()
  @UseGuards(InternalServiceGuard)
  @Post('internal/ingest-batch')
  ingestBatch(@Body() dto: { points: { productId: string; metricName: string; value: number; timestamp?: string }[] }) {
    return this.monitoring.ingestBatchInternal(dto.points);
  }

  /** Internal: create an alert (worker uptime-check failures, AI anomalies). */
  @Public()
  @UseGuards(InternalServiceGuard)
  @Post('internal/alerts')
  createAlertInternal(
    @Body()
    dto: {
      productId: string;
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      message: string;
      metricName?: string;
      metricValue?: number;
      aiConfidence?: number | null;
    },
  ) {
    return this.monitoring.createAlertInternal(dto);
  }
}
