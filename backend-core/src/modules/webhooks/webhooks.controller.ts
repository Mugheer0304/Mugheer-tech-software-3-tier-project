import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';
import { Public } from '../../common/decorators/roles.decorator';

@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooks: WebhooksService) {}

  @Public()
  @HttpCode(200)
  @Post('stripe')
  async stripe(@Req() req: Request, @Headers('stripe-signature') signature: string | undefined, @Body() payload: Record<string, unknown>) {
    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(payload);
    return this.webhooks.processStripe(rawBody, signature, payload);
  }

  @Public()
  @HttpCode(200)
  @Post('github')
  async github(@Req() req: Request, @Headers('x-hub-signature-256') signature: string | undefined, @Body() payload: Record<string, unknown>) {
    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(payload);
    return this.webhooks.processGithub(payload, signature, rawBody);
  }
}
