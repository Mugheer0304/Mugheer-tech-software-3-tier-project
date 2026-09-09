import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';

interface AuthedRequest extends Request {
  user: { id: string; email: string; role: string; orgId?: string | null };
  params: { keyId?: string };
}

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  async me(@Req() req: AuthedRequest) {
    return this.users.getProfile(req.user.id);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  list(@Req() req: AuthedRequest) {
    return this.users.list({ ...req.user, orgId: req.user.orgId ?? undefined });
  }

  @Post('invite')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CLIENT_OWNER')
  invite(@Req() req: AuthedRequest, @Body() dto: { email: string; name: string; role: string }) {
    return this.users.invite(req.user.orgId ?? '', req.user, dto);
  }

  @Patch(':id/role')
  @Roles('SUPER_ADMIN', 'ADMIN')
  updateRole(@Req() req: AuthedRequest, @Param('id') userId: string, @Body() dto: { role: string }) {
    return this.users.updateRole(req.user, userId, dto.role);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  deactivate(@Req() req: AuthedRequest, @Param('id') userId: string) {
    return this.users.deactivate(req.user, userId);
  }
}
