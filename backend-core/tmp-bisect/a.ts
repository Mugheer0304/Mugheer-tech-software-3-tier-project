import { Injectable } from '@nestjs/common';
import { PrismaService } from '../src/common/prisma.service';
import { StripeService } from '../src/modules/billing/stripe.service';
@Injectable()
export class A { constructor(private p: PrismaService, private s: StripeService) {} }
