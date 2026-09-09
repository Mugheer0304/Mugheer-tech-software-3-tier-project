import { describe, expect, it } from 'vitest';
import { RolesGuard } from '../../src/common/guards/roles.guard';

describe('RolesGuard (server-side RBAC)', () => {
  const makeReflector = (roles?: string[], perms?: string[], isPublic = false) => ({
    getAllAndOverride: (key: string) => {
      if (key === 'mugheer:public') return isPublic;
      if (key === 'mugheer:roles') return roles;
      if (key === 'mugheer:permissions') return perms;
      return undefined;
    },
  });

  const makeContext = (user: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as never;

  it('denies when no user is present and route is not public', () => {
    const guard = new RolesGuard(makeReflector(['ADMIN']) as never);
    expect(guard.canActivate(makeContext(null))).toBe(false);
  });

  it('allows public routes without a user', () => {
    const guard = new RolesGuard(makeReflector(undefined, undefined, true) as never);
    expect(guard.canActivate(makeContext(null))).toBe(true);
  });

  it('denies a role not in required roles', () => {
    const guard = new RolesGuard(makeReflector(['ADMIN']) as never);
    expect(guard.canActivate(makeContext({ role: 'CLIENT_MEMBER' }))).toBe(false);
  });

  it('allows a matching role', () => {
    const guard = new RolesGuard(makeReflector(['ADMIN']) as never);
    expect(guard.canActivate(makeContext({ role: 'ADMIN' }))).toBe(true);
  });

  it('super admin passes any role check', () => {
    const guard = new RolesGuard(makeReflector(['ADMIN']) as never);
    expect(guard.canActivate(makeContext({ role: 'SUPER_ADMIN' }))).toBe(true);
  });

  it('enforces permission requirements (deny by default)', () => {
    const guard = new RolesGuard(makeReflector(undefined, ['billing:write']) as never);
    expect(guard.canActivate(makeContext({ role: 'ENGINEER', permissions: ['metrics:read'] }))).toBe(false);
    expect(guard.canActivate(makeContext({ role: 'ENGINEER', permissions: ['billing:write'] }))).toBe(true);
  });
});
