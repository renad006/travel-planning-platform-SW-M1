import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  PROVIDER_SCOPE_KEY,
  ProviderScopeOptions,
} from '../decorators/provider-scope.decorator';
import { ProviderType } from '../enums/provider-type.enum';
import { Role } from '../enums/role.enum';
import { UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class ProviderScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const scope = this.reflector.getAllAndOverride<
      ProviderScopeOptions | undefined
    >(PROVIDER_SCOPE_KEY, [context.getHandler(), context.getClass()]);
    if (!scope) {
      return true; // route is not provider-scoped
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: UserDocument }>();
    const user = request.user;
    if (user?.role === Role.ADMIN) {
      return true; // admins can manage any provider
    }
    const providerId = String(request.params[scope.param]);

    const expectedRole =
      scope.type === ProviderType.AIRLINE
        ? Role.AIRLINE_MODERATOR
        : Role.HOTEL_MODERATOR;

    const allowed =
      !!user &&
      user.role === expectedRole &&
      user.assignedProviderType === scope.type &&
      !!user.assignedProviderId &&
      user.assignedProviderId.toString() === providerId;

    if (!allowed) {
      throw new ForbiddenException(
        'You can only manage your own assigned provider',
      );
    }
    return true;
  }
}