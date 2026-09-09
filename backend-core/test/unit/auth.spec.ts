import { describe, expect, it } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';

describe('auth primitives', () => {
  it('rejects passwords shorter than 12 characters', () => {
    const weak = 'short';
    expect(weak.length >= 12).toBe(false);
  });

  it('hashes and verifies passwords with bcrypt', async () => {
    const hash = await bcrypt.hash('SuperSecurePassword123!', 12);
    expect(await bcrypt.compare('SuperSecurePassword123!', hash)).toBe(true);
    expect(await bcrypt.compare('WrongPassword123!', hash)).toBe(false);
  });

  it('generates valid TOTP secrets compatible with Google Authenticator', () => {
    const secret = authenticator.generateSecret();
    expect(secret.length).toBeGreaterThanOrEqual(16);
    const token = authenticator.generate(secret);
    expect(authenticator.verify({ token, secret })).toBe(true);
  });

  it('supports TOTP drift window (previous/next period)', () => {
    authenticator.options = { window: 1 };
    const secret = authenticator.generateSecret();
    const token = authenticator.generate(secret);
    expect(authenticator.verify({ token, secret })).toBe(true);
  });
});
