import { Controller, Get, Query, Req } from '@nestjs/common';
import { AuditService } from './audit.service';

interface AuthedRequest extends Request {
  user: { role: string };
  orgId?: string;
}

@Controller('audit')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query() q: { actorType?: string; action?: string; cursor?: string; limit?: string }) {
    return this.audit.list(req.user, { ...q, limit: q.limit ? parseInt(q.limit, 10) : undefined });
  }
}
