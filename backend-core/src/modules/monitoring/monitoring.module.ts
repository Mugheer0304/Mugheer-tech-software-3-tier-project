import { Global, Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { AlertsService } from './alerts.service';

@Global()
@Module({
  controllers: [MonitoringController],
  providers: [MonitoringService, AlertsService],
  exports: [MonitoringService, AlertsService],
})
export class MonitoringModule {}
