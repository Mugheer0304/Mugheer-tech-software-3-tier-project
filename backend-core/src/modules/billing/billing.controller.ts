import { Body, Controller, Get, Header, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { BillingService } from './billing.service';
import { renderInvoice } from './invoice-template';
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

  /**
   * Downloadable invoice document (PDF via print / plain-text fallback).
   * Carries Mugheer-Tech name, email and phone on every invoice
   * (spec Section 27 — contact details wired into the template, not just docs).
   */
  @Get('invoices/:id/download')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async downloadInvoice(@Req() req: AuthedRequest, @Param('id') id: string, @Res() res: Response) {
    const invoice = await this.billing.getInvoice(req.user, id);
    const doc = renderInvoice({
      number: invoice.number,
      orgName: invoice.organization.name,
      amount: invoice.amount,
      taxAmount: invoice.taxAmount,
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      lineItems: (invoice.lineItems as { description: string; quantity: number; unitPrice: number }[]) ?? undefined,
    });
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.number}.txt"`);
    res.send(doc);
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
