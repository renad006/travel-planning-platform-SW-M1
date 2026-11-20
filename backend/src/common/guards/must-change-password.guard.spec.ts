import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { MustChangePasswordGuard } from './must-change-password.guard';

function ctx(user: unknown, path: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, path }) }),
  } as unknown as ExecutionContext;
}

describe('MustChangePasswordGuard', () => {
  const guard = new MustChangePasswordGuard();

  it('allows public routes with no user', () => {
    expect(guard.canActivate(ctx(undefined, '/api/flights'))).toBe(true);
  });

  it('allows normal accounts anywhere', () => {
    const user = { mustChangePassword: false };
    expect(guard.canActivate(ctx(user, '/api/flights'))).toBe(true);
  });

  it('blocks a temporary-password account on other routes', () => {
    const user = { mustChangePassword: true };
    expect(() => guard.canActivate(ctx(user, '/api/flights'))).toThrow(
      ForbiddenException,
    );
  });

  it('lets a temporary-password account change its password', () => {
    const user = { mustChangePassword: true };
    expect(
      guard.canActivate(ctx(user, '/api/auth/change-password')),
    ).toBe(true);
  });

  it('lets a temporary-password account log out and read /me', () => {
    const user = { mustChangePassword: true };
    expect(guard.canActivate(ctx(user, '/api/auth/logout'))).toBe(true);
    expect(guard.canActivate(ctx(user, '/api/auth/me'))).toBe(true);
  });
});