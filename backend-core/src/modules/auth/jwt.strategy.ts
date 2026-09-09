import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { PrismaService } from '../../common/prisma.service';
import { config } from '../../common/config';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  orgId?: string | null;
  type: 'access' | 'refresh' | 'service';
  jti?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.['mugheer_access'] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type');
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, isActive: true },
    });
    if (!user) throw new UnauthorizedException('User not found or inactive');
    // Resolve the user's primary org membership so every controller/service has
    // tenant context on the user object itself (org-scoped RBAC + isolation).
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' },
    });
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      orgId: membership?.organizationId ?? null,
    };
  }
}
