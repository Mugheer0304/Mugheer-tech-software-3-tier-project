import { Module } from '@nestjs/common';
import { AppConfigModule } from './common/config.module';
import { PrismaModule } from './common/prisma.module';
import { AuditGlobalModule } from './common/audit.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { BillingModule } from './modules/billing/billing.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { AutomationModule } from './modules/automation/automation.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { AiModule } from './modules/ai/ai.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { HealthModule } from './modules/health/health.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuditGlobalModule,
    AuthModule,
    UsersModule,
    OrgsModule,
    ProjectsModule,
    BillingModule,
    MonitoringModule,
    AutomationModule,
    TicketsModule,
    NotificationsModule,
    AuditModule,
    AiModule,
    WebhooksModule,
    HealthModule,
    RealtimeModule,
    AdminModule,
  ],
})
export class AppModule {}
