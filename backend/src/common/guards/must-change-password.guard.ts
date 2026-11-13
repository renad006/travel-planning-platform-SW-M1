import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { UserDocument } from '../../users/schemas/user.schema';

// ACC-13 / ACC-07a: an account with a temporary password may only change it,
// read its own profile or log out until the password is changed.
const ALLOWED_PATHS = [
  '/api/auth/change-password',
  '/api/auth/logout',
  '/api/auth/me',
];

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: UserDocument }>();
    const user = request.user;

    // Public routes have no user, and normal accounts are not restricted
    if (!user?.mustChangePassword) {
      return true;
    }

    const path = request.path.replace(/\/+$/, '');
    if (ALLOWED_PATHS.includes(path)) {
      return true;
    }

    throw new ForbiddenException(
      'You must change your temporary password first',
    );
  }
}