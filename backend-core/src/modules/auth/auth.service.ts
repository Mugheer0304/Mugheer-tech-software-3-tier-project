import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { PrismaService } from '../../common/prisma.service';
import { config } from '../../common/config';
import type { JwtPayload } from './jwt.strategy';

const BREACH_CHECK_URL = 'https://api.pwnedpasswords.com/range/';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // ---------------------------------------------------------------- signup
  async signup(dto: { email: string; password: string; name: string; orgName?: string }) {
    this.assertPasswordStrength(dto.password);
    await this.checkBreachList(dto.password);
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: 'CLIENT_OWNER',
      },
    });
    const org = await this.prisma.organization.create({
      data: { name: dto.orgName ?? `${dto.name}'s Org`, slug: this.slugify(dto.orgName ?? dto.email), type: 'CLIENT' },
    });
    await this.prisma.organizationMember.create({
      data: { organizationId: org.id, userId: user.id, role: 'CLIENT_OWNER' },
    });
    return this.issueTokens(user.id, user.email, user.role);
  }

  // ----------------------------------------------------------------- login
  async login(dto: { email: string; password: string; totp?: string }, meta: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } });
    if (!user?.passwordHash) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account disabled');
    if (user.mfaEnabled) {
      if (!dto.totp) throw new UnauthorizedException('TOTP code required');
      const ok = authenticator.verify({ token: dto.totp, secret: user.mfaSecret ?? '' });
      if (!ok) throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user.id, user.email, user.role, meta);
  }

  // ------------------------------------------------------------- refresh
  async refresh(token: string, meta: { ip?: string; userAgent?: string }) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync(token, { secret: config.jwt.refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hash(token) } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // possible reuse — revoke the whole family
      if (stored?.revokedAt && stored.family) {
        await this.prisma.refreshToken.updateMany({
          where: { family: stored.family, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Refresh token expired or revoked');
    }
    const user = await this.prisma.user.findFirst({ where: { id: payload.sub, deletedAt: null, isActive: true } });
    if (!user) throw new UnauthorizedException('User inactive');

    // rotate: revoke old, issue new in same family
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(user.id, user.email, user.role, meta, stored.family);
  }

  async logout(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------- 2FA
  async setupTotp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });
    const otpauth = authenticator.keyuri(user.email, 'Mugheer', secret);
    const qrDataUrl = await toDataURL(otpauth);
    return { secret, otpauth, qrDataUrl };
  }

  async confirmTotp(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new BadRequestException('Run setup first');
    const ok = authenticator.verify({ token, secret: user.mfaSecret });
    if (!ok) throw new BadRequestException('Invalid code');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return { enabled: true };
  }

  async disableTotp(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled) throw new BadRequestException('2FA not enabled');
    const ok = authenticator.verify({ token, secret: user.mfaSecret ?? '' });
    if (!ok) throw new BadRequestException('Invalid code');
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    return { enabled: false };
  }

  // ---------------------------------------------------------------- OAuth
  async findOrCreateOAuthUser(profile: { provider: 'google' | 'github'; id: string; email: string; name: string }) {
    const providerField = profile.provider === 'google' ? 'googleId' : 'githubId';
    let user = await this.prisma.user.findFirst({
      where: { [providerField]: profile.id },
    });
    if (!user) {
      user = await this.prisma.user.findFirst({ where: { email: profile.email, deletedAt: null } });
      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { [providerField]: profile.id },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            role: 'CLIENT_OWNER',
            [providerField]: profile.id,
          },
        });
      }
    }
    return this.issueTokens(user.id, user.email, user.role);
  }

  // -------------------------------------------------------------- API keys
  async createApiKey(orgId: string, dto: { name: string; scopes: string[]; createdBy?: string }) {
    const raw = `mk_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = this.hash(raw);
    const prefix = raw.slice(0, 11);
    const key = await this.prisma.apiKey.create({
      data: { organizationId: orgId, name: dto.name, keyHash, prefix, scopes: dto.scopes, createdBy: dto.createdBy },
    });
    return { id: key.id, name: key.name, prefix, rawKey: raw, scopes: key.scopes };
  }

  async verifyApiKey(raw: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash: this.hash(raw) } });
    if (!key || key.revokedAt) return null;
    await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return key;
  }

  async revokeApiKey(orgId: string, keyId: string) {
    await this.prisma.apiKey.updateMany({
      where: { id: keyId, organizationId: orgId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  // ------------------------------------------------------------------ misc
  private assertPasswordStrength(password: string) {
    if (password.length < 12) {
      throw new BadRequestException('Password must be at least 12 characters');
    }
  }

  /** Breach check via k-anonymity range API — only first 5 chars of SHA-1 sent. */
  private async checkBreachList(password: string) {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = sha1.slice(0, 5);
      const suffix = sha1.slice(5);
      const res = await fetch(`${BREACH_CHECK_URL}${prefix}`);
      if (!res.ok) return;
      const body = await res.text();
      if (body.split('\n').some((line) => line.split(':')[0].trim() === suffix)) {
        throw new BadRequestException('Password appears in a known breach list');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // breach service unavailable — fail open but log
    }
  }

  private slugify(input: string) {
    return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) + '-' + crypto.randomBytes(3).toString('hex');
  }

  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
    meta?: { ip?: string; userAgent?: string },
    family?: string,
  ) {
    // jti guarantees every token is unique even when issued in the same second,
    // so refresh-token hashes never collide (reuse detection depends on this).
    const jti = crypto.randomUUID();
    const accessPayload: JwtPayload = { sub: userId, email, role, type: 'access', jti };
    const refreshPayload: JwtPayload = { sub: userId, email, role, type: 'refresh', jti: crypto.randomUUID() };
    const accessToken = await this.jwt.signAsync(accessPayload);
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: config.jwt.refreshSecret,
      expiresIn: config.jwt.refreshTtl,
    });
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(refreshToken),
        family: family ?? crypto.randomUUID(),
        expiresAt: new Date(Date.now() + config.jwt.refreshTtl * 1000),
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });
    return { accessToken, refreshToken, expiresIn: config.jwt.accessTtl };
  }
}
