import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProviderScopeGuard } from './provider-scope.guard';
import { ProviderType } from '../enums/provider-type.enum';
import { Role } from '../enums/role.enum';

const reflector = {
  getAllAndOverride: () => ({ type: ProviderType.AIRLINE, param: 'id' }),
} as unknown as Reflector;
const guard = new ProviderScopeGuard(reflector);

function ctx(user: unknown, id: string): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user, params: { id } }),
    }),
  } as unknown as ExecutionContext;
}

const airlineMod = {
  role: Role.AIRLINE_MODERATOR,
  assignedProviderType: ProviderType.AIRLINE,
  assignedProviderId: { toString: () => 'airline-1' },
};

describe('ProviderScopeGuard', () => {
  it('allows the moderator of the matching airline', () => {
    expect(guard.canActivate(ctx(airlineMod, 'airline-1'))).toBe(true);
  });

  it('blocks a moderator of another airline', () => {
    expect(() => guard.canActivate(ctx(airlineMod, 'airline-2'))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks a hotel moderator on an airline route', () => {
    const hotelMod = {
      role: Role.HOTEL_MODERATOR,
      assignedProviderType: ProviderType.HOTEL,
      assignedProviderId: { toString: () => 'airline-1' },
    };
    expect(() => guard.canActivate(ctx(hotelMod, 'airline-1'))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks a normal user', () => {
    expect(() =>
      guard.canActivate(ctx({ role: Role.USER }, 'airline-1')),
    ).toThrow(ForbiddenException);
  });

  it('allows an admin on any provider', () => {
    expect(guard.canActivate(ctx({ role: Role.ADMIN }, 'airline-2'))).toBe(
      true,
    );
  });
});

