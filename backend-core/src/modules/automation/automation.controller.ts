import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { Roles, Public } from '../../common/decorators/roles.decorator';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';

interface AuthedRequest extends Request {
  user: { id: string; role: string };
  orgId?: string;
}

@Controller('automation')
export class AutomationController {
  constructor(private automation: AutomationService) {}

  @Get('runbooks')
  list(@Req() req: AuthedRequest, @Query() q: { productId?: string }) {
    return this.automation.listRunbooks(req.user, q.productId);
  }

  @Post('runbooks')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER')
  create(@Req() req: AuthedRequest, @Body() dto: Parameters<AutomationService['createRunbook']>[1]) {
    return this.automation.createRunbook(req.user, dto);
  }

  @Patch('runbooks/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER')
  update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: Parameters<AutomationService['updateRunbook']>[2]) {
    return this.automation.updateRunbook(req.user, id, dto);
  }

  @Delete('runbooks/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER')
  delete(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.automation.deleteRunbook(req.user, id);
  }

  @Post('runbooks/:id/execute')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER')
  execute(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.automation.execute(id, 'USER');
  }

  /** Internal runbook execution (worker/AI-triggered). Attributed in the audit log. */
  @Public()
  @UseGuards(InternalServiceGuard)
  @Post('internal/runbooks/:id/execute')
  executeInternal(@Param('id') id: string, @Body() dto: { triggeredBy?: 'SYSTEM' | 'AI_AGENT' }) {
    return this.automation.execute(id, dto.triggeredBy ?? 'SYSTEM');
  }
}
