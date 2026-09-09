import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  constructor(private gateway: RealtimeGateway) {}

  pushMetric(productId: string, metricName: string, value: number) {
    this.gateway.emitMetric(productId, { metricName, value, timestamp: new Date().toISOString() });
  }

  pushAlert(productId: string, alert: { id: string; severity: string; message: string }) {
    this.gateway.emitAlert(productId, alert);
  }
}
