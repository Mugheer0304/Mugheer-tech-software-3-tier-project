import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { config } from '../../common/config';

interface AuthedRequest extends Request {
  user: { id: string; email: string; role: string };
  orgId?: string;
  params: { keyId?: string };
}

const REFRESH_COOKIE = 'mugheer_refresh';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('signup')
  async signup(@Body() dto: { email: string; password: string; name: string; orgName?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.signup(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: { email: string; password: string; totp?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.login(dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, mfaRequired: false };
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    const tokens = await this.auth.refresh(token, { ip: req.ip, userAgent: req.headers['user-agent'] });
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE);
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: AuthedRequest) {
    return req.user;
  }

  // ------------------------------------------------------------------ 2FA
  @Post('2fa/setup')
  setupTotp(@Req() req: AuthedRequest) {
    return this.auth.setupTotp(req.user.id);
  }

  @Post('2fa/confirm')
  confirmTotp(@Req() req: AuthedRequest, @Body() dto: { token: string }) {
    return this.auth.confirmTotp(req.user.id, dto.token);
  }

  @Post('2fa/disable')
  disableTotp(@Req() req: AuthedRequest, @Body() dto: { token: string }) {
    return this.auth.disableTotp(req.user.id, dto.token);
  }

  // ------------------------------------------------------------- API keys
  @Post('api-keys')
  createKey(@Req() req: AuthedRequest, @Body() dto: { name: string; scopes: string[]; orgId: string }) {
    return this.auth.createApiKey(dto.orgId, { name: dto.name, scopes: dto.scopes, createdBy: req.user.id });
  }

  @Post('api-keys/:keyId/revoke')
  revokeKey(@Req() req: AuthedRequest) {
    const keyId = (req.params as { keyId: string }).keyId;
    const orgId = req.user.role === 'SUPER_ADMIN' ? (req.body?.orgId ?? '') : (req as unknown as { orgId?: string }).orgId ?? '';
    return this.auth.revokeApiKey(orgId, keyId);
  }

  // ---------------------------------------------------------- OAuth entry
  @Public()
  @Get('google')
  googleAuth() {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', config.oauth.google.clientId);
    url.searchParams.set('redirect_uri', config.oauth.google.callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    return { url: url.toString() };
  }

  @Public()
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const code = (req.query.code as string) ?? '';
    const tokens = await this.exchangeGoogleCode(code);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Get('github')
  githubAuth() {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', config.oauth.github.clientId);
    url.searchParams.set('redirect_uri', config.oauth.github.callbackUrl);
    url.searchParams.set('scope', 'read:user user:email');
    return { url: url.toString() };
  }

  @Public()
  @Get('github/callback')
  async githubCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const code = (req.query.code as string) ?? '';
    const tokens = await this.exchangeGithubCode(code);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  private async exchangeGoogleCode(code: string) {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.oauth.google.clientId,
        client_secret: config.oauth.google.clientSecret,
        redirect_uri: config.oauth.google.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error('Google token exchange failed');
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const profile = (await profileRes.json()) as { sub: string; email: string; name?: string };
    return this.auth.findOrCreateOAuthUser({
      provider: 'google',
      id: profile.sub,
      email: profile.email,
      name: profile.name ?? profile.email,
    });
  }

  private async exchangeGithubCode(code: string) {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        code,
        client_id: config.oauth.github.clientId,
        client_secret: config.oauth.github.clientSecret,
        redirect_uri: config.oauth.github.callbackUrl,
      }),
    });
    if (!tokenRes.ok) throw new Error('GitHub token exchange failed');
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const profileRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'mugheer' },
    });
    const profile = (await profileRes.json()) as { id: number; login: string; name?: string };
    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'mugheer' },
    });
    const emails = (await emailRes.json()) as { email: string; primary: boolean }[];
    const email = emails.find((e) => e.primary)?.email ?? `${profile.login}@users.noreply.github.com`;
    return this.auth.findOrCreateOAuthUser({
      provider: 'github',
      id: String(profile.id),
      email,
      name: profile.name ?? profile.login,
    });
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'lax',
      maxAge: config.jwt.refreshTtl * 1000,
      path: '/api/v1/auth',
    });
  }
}
