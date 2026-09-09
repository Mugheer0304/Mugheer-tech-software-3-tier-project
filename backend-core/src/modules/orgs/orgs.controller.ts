import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { OrgsService } from './orgs.service';

interface AuthedRequest extends Request {
  user: { id: string; role: string; orgId?: string | null };
}

@Controller('orgs')
export class OrgsController {
  constructor(private orgs: OrgsService) {}

  @Get('current')
  async current(@Req() req: AuthedRequest) {
    return this.orgs.get(req.user.orgId ?? '');
  }

  @Patch('current')
  async update(@Req() req: AuthedRequest, @Body() dto: { name?: string; taxRate?: number; taxRegion?: string }) {
    return this.orgs.update({ ...req.user, orgId: req.user.orgId ?? undefined }, req.user.orgId ?? '', dto);
  }
}
