import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { config } from '../../common/config';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  client: Stripe | null = null;

  constructor() {
    if (config.stripe.secretKey) {
      this.client = new Stripe(config.stripe.secretKey, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set — billing runs in mock mode');
    }
  }

  get enabled() {
    return this.client !== null;
  }
}
