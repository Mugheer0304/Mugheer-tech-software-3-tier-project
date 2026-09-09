import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Roles, Public } from '../../common/decorators/roles.decorator';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';

interface AuthedRequest extends Request {
  user: { id: string; role: string };
  orgId?: string;
}

@Controller('billing')
export class BillingController {
  constructor(private billing: BillingService) {}

  @Get('plans')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CLIENT_OWNER', 'CLIENT_MEMBER')
  listPlans() {
    return this.billing.listPlans();
  }

  @Get('invoices')
  listInvoices(@Req() req: AuthedRequest) {
    return this.billing.listInvoices(req.user);
  }

  @Get('invoices/:id')
  getInvoice(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.billing.getInvoice(req.user, id);
  }

  @Post('invoices')
  @Roles('SUPER_ADMIN', 'ADMIN')
  createInvoice(@Req() req: AuthedRequest, @Body() dto: { orgId: string; amount: number; currency?: string; dueDate?: string; lineItems: { description: string; quantity: number; unitPrice: number }[] }) {
    return this.billing.createInvoice(req.user, dto);
  }

  @Post('invoices/:id/pay')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CLIENT_OWNER')
  payInvoice(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.billing.payInvoice(req.user, id);
  }

  @Post('invoices/:id/refund')
  @Roles('SUPER_ADMIN', 'ADMIN')
  refund(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: { amount: number }) {
    return this.billing.refund(req.user, id, dto.amount);
  }

  @Post('subscriptions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CLIENT_OWNER')
  subscribe(@Req() req: AuthedRequest, @Body() dto: { planId: string }) {
    return this.billing.subscribe(req.user, dto.planId);
  }

  @Get('subscriptions')
  listSubscriptions(@Req() req: AuthedRequest) {
    return this.billing.listSubscriptions(req.user);
  }

  @Post('subscriptions/:id/cancel')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CLIENT_OWNER')
  cancel(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.billing.cancelSubscription(req.user, id);
  }

  /** Internal: worker dunning pass (scheduled daily). */
  @Public()
  @UseGuards(InternalServiceGuard)
  @Post('internal/dunning/run')
  dunningRun() {
    return this.billing.runDunningPass();
  }
}
