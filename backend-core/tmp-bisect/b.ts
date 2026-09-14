import { Injectable } from '@nestjs/common';
import { PrismaService } from '../src/common/prisma.service';
@Injectable()
export class B { constructor(private p: PrismaService) {} }
