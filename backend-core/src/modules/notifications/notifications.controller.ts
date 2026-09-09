import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Public } from '../../common/decorators/roles.decorator';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';

interface AuthedRequest extends Request {
  user: { id: string; orgId?: string | null };
}

@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.notifications.list(req.user.orgId ?? '', req.user.id);
  }

  @Patch(':id/read')
  markRead(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.notifications.markRead(req.user.orgId ?? '', id);
  }

  /** Internal: worker and services push system notifications (reports, runbook results). */
  @Public()
  @UseGuards(InternalServiceGuard)
  @Post('internal')
  internalNotify(
    @Body() dto: { orgId: string; type: 'alert' | 'invoice' | 'ticket' | 'project' | 'system'; title: string; body: string },
  ) {
    return this.notifications.notifyOrg(dto.orgId, { type: dto.type, title: dto.title, body: dto.body });
  }
}
