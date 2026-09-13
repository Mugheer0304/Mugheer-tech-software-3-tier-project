import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { Roles } from '../../common/decorators/roles.decorator';

interface AuthedRequest extends Request {
  user: { id: string; email: string; role: string; orgId?: string | null };
  query: Record<string, string | undefined>;
}

/** Adapter: services expect orgId as string|undefined. */
const principal = (u: AuthedRequest['user']) => ({ ...u, orgId: u.orgId ?? undefined });

@Controller('projects')
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.projects.listProducts(principal(req.user), { status: (req.query as { status?: string }).status, serviceLine: (req.query as { serviceLine?: string }).serviceLine });
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.projects.getProduct(principal(req.user), id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'CLIENT_OWNER')
  create(@Req() req: AuthedRequest, @Body() dto: { name: string; serviceLine: string; description?: string }) {
    return this.projects.createProduct({ ...principal(req.user), orgId: req.user.orgId ?? undefined }, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER')
  update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.projects.updateProduct(req.user, id, dto as never);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER')
  updateStatus(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: { status: string }) {
    return this.projects.updateStatus(req.user, id, dto.status);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  delete(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.projects.softDelete(req.user, id);
  }

  // --------------------------------------------------------------- quotes
  @Post(':id/quote')
  @Roles('SUPER_ADMIN', 'ADMIN')
  createQuote(@Req() req: AuthedRequest, @Param('id') productId: string, @Body() dto: { amount: number; currency?: string; breakdown?: { name: string; percent: number; amount: number }[]; validUntil?: string }) {
    return this.projects.createQuote(req.user, productId, dto);
  }

  @Post('quotes/:quoteId/approve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CLIENT_OWNER')
  approveQuote(@Req() req: AuthedRequest, @Param('quoteId') quoteId: string) {
    return this.projects.approveQuote(principal(req.user), quoteId);
  }

  // -------------------------------------------------------- design review
  @Post(':id/designs')
  @Roles('SUPER_ADMIN', 'ADMIN', 'DESIGNER', 'ENGINEER')
  addDesign(@Req() req: AuthedRequest, @Param('id') productId: string, @Body() dto: { name: string; fileUrl: string }) {
    return this.projects.addDesignArtifact(req.user, productId, dto);
  }

  @Post('designs/:artifactId/review')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CLIENT_OWNER')
  reviewDesign(@Req() req: AuthedRequest, @Param('artifactId') artifactId: string, @Body() dto: { approve: boolean; feedback?: string }) {
    return this.projects.reviewDesign(principal(req.user), artifactId, dto.approve, dto.feedback);
  }

  // ------------------------------------------------------ collaboration
  @Get(':id/comments')
  listComments(@Req() req: AuthedRequest, @Param('id') productId: string) {
    return this.projects.listComments(principal(req.user), productId);
  }

  @Post(':id/comments')
  addComment(@Req() req: AuthedRequest, @Param('id') productId: string, @Body() dto: { body: string; designArtifactId?: string }) {
    return this.projects.addComment(principal(req.user), productId, dto.body, dto.designArtifactId);
  }

  @Get('messages')
  listMessages(@Req() req: AuthedRequest) {
    return this.projects.listMessages(principal(req.user));
  }

  @Post('messages')
  sendMessage(@Req() req: AuthedRequest, @Body() dto: { body: string }) {
    return this.projects.sendMessage(principal(req.user), dto.body);
  }

  @Get('files')
  listFiles(@Req() req: AuthedRequest, @Query('productId') productId?: string) {
    return this.projects.listFiles(principal(req.user), productId);
  }

  @Post('files')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'DESIGNER', 'CLIENT_OWNER')
  addFile(@Req() req: AuthedRequest, @Body() dto: { productId?: string; name: string; fileUrl: string; sizeBytes: number; mimeType: string }) {
    return this.projects.addFile(principal(req.user), dto);
  }

  // ----------------------------------------------------------- deployment
  @Post(':id/deployments')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ENGINEER')
  recordDeployment(@Req() req: AuthedRequest, @Param('id') productId: string, @Body() dto: { environment: string; commitSha: string; commitMsg?: string }) {
    return this.projects.recordDeployment(req.user.orgId ?? '', productId, { ...dto, triggeredBy: req.user.id });
  }
}
