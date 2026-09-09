import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { Roles, Public } from '../../common/decorators/roles.decorator';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';
import { PrismaService } from '../../common/prisma.service';

interface AuthedRequest extends Request {
  user: { id: string; role: string; orgId?: string | null };
}

@Controller('ai')
export class AiController {
  constructor(
    private ai: AiService,
    private prisma: PrismaService,
  ) {}

  @Post('scope')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CLIENT_OWNER')
  scope(@Req() req: AuthedRequest, @Body() dto: { description: string }) {
    return this.ai.scopeProduct(req.user, { description: dto.description, orgId: req.user.orgId ?? undefined });
  }

  @Post('code-assist')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER')
  codeAssist(@Req() req: AuthedRequest, @Body() dto: { context: string; question: string; projectId?: string }) {
    return this.ai.codeAssist(req.user, dto);
  }

  @Get('action-logs')
  @Roles('SUPER_ADMIN', 'ADMIN')
  actionLogs(@Req() req: AuthedRequest) {
    const where = req.user.role === 'SUPER_ADMIN' ? {} : { orgId: req.user.orgId };
    return this.prisma.aiActionLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  /** Internal: worker pushes generated insight summaries (weekly reports). */
  @Public()
  @UseGuards(InternalServiceGuard)
  @Post('internal/insights')
  internalInsight(
    @Body() dto: { productId: string; metrics: Record<string, { avg: number; max: number; min: number }> },
  ) {
    return this.ai.generateInsight(
      dto.productId,
      Object.fromEntries(Object.entries(dto.metrics).map(([k, v]) => [k, v.avg])),
    );
  }
}
