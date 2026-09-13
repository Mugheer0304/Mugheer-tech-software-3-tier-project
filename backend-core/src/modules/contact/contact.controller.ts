import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ContactService } from './contact.service';
import { Roles, Public } from '../../common/decorators/roles.decorator';

interface AuthedRequest extends Request {
  user: { id: string; role: string };
  orgId?: string;
}

@Controller('contact')
export class ContactController {
  constructor(private contact: ContactService) {}

  /** Public — the Contact Us page form writes here (spec Section 27). */
  @Public()
  @Post()
  submit(
    @Body()
    dto: {
      name: string;
      email: string;
      phone?: string;
      company?: string;
      message: string;
      sourcePage?: string;
    },
  ) {
    return this.contact.submit(dto);
  }

  /** Internal — staff review inbound leads in the admin console. */
  @Roles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
  @Get()
  list(@Query('status') status?: string) {
    return this.contact.list(status);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
  @Post(':id/status')
  updateStatus(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: { status: string }) {
    return this.contact.updateStatus(req.user, id, dto.status);
  }
}
