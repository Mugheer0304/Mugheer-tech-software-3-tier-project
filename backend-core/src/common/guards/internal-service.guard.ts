import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';

/**
 * Guards internal service-to-service endpoints (worker -> core, AI services -> core).
 * Requests must carry: Authorization: Bearer <INTERNAL_SERVICE_TOKEN>
 * Invalid or missing credentials raise 401 (never silently treated as 403 RBAC denial).
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
    const expected = process.env.INTERNAL_SERVICE_TOKEN ?? '';
    const ok =
      expected.length > 0 &&
      token.length >= 16 &&
      token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    if (!ok) throw new UnauthorizedException('Invalid internal service token');
    return true;
  }
}
