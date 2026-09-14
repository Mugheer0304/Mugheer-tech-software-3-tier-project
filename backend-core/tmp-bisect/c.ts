import { Injectable } from '@nestjs/common';
import { StripeService } from '../src/modules/billing/stripe.service';
@Injectable()
export class C { constructor(private s: StripeService) {} }
