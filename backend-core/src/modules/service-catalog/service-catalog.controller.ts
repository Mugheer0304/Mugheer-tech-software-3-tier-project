import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { ServiceCatalogService } from './service-catalog.service';
import { Roles, Public } from '../../common/decorators/roles.decorator';

interface AuthedRequest extends Request {
  user: { id: string; role: string };
  orgId?: string;
}

/**
 * Service Catalog — the single backend owner of the service_lines table
 * (spec Section 18). The Service Box UI on the marketing site, client
 * dashboard and admin console all read from these endpoints; nothing is
 * hardcoded in the frontend.
 */
@Controller('service-catalog')
export class ServiceCatalogController {
  constructor(private catalog: ServiceCatalogService) {}

  /** Public — powers Service Boxes for visitors and logged-in clients alike. */
  @Public()
  @Get()
  listActive() {
    return this.catalog.listActive();
  }

  /** Public — detail view behind a clicked Service Box. */
  @Public()
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.catalog.getBySlug(slug);
  }

  /** Internal — admin console view including inactive services. */
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get('admin/all')
  listAll() {
    return this.catalog.listAll();
  }

  /** Internal — manage pricing, copy, pipeline and active flag per service. */
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch('admin/:slug')
  update(
    @Req() req: AuthedRequest,
    @Param('slug') slug: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.catalog.update(req.user, slug, dto);
  }
}
