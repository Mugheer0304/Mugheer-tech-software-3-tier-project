import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';

interface AuthedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('stats')
  @Roles('SUPER_ADMIN', 'ADMIN')
  stats() {
    return this.admin.stats();
  }

  @Get('pricing')
  @Roles('SUPER_ADMIN', 'ADMIN')
  pricing() {
    return this.admin.listPricing();
  }

  @Post('pricing')
  @Roles('SUPER_ADMIN')
  setPricing(@Req() req: AuthedRequest, @Body() dto: Parameters<AdminService['setPricing']>[1]) {
    return this.admin.setPricing(req.user, dto);
  }
}
