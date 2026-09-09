import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Roles } from '../../common/decorators/roles.decorator';

interface AuthedRequest extends Request {
  user: { id: string; role: string };
  orgId?: string;
}

@Controller('tickets')
export class TicketsController {
  constructor(private tickets: TicketsService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query() q: { status?: string; productId?: string }) {
    return this.tickets.list(req.user, q);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.tickets.get(req.user, id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: { productId?: string; subject: string; body: string; category?: string; priority?: string }) {
    return this.tickets.create(req.user, dto);
  }

  @Post(':id/reply')
  reply(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: { body: string; isAiDraft: boolean }) {
    return this.tickets.reply(req.user, id, dto.body, { isAiDraft: dto.isAiDraft });
  }

  @Post(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'SUPPORT')
  updateStatus(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: { status: string }) {
    return this.tickets.updateStatus(req.user, id, dto.status);
  }
}
