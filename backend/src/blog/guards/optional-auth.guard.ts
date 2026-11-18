import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Run the standard passport JWT logic
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    // If there's an error (no token, expired token) just return null
    // so the request continues as a guest, instead of throwing a 401.
    if (err || !user) {
      return null;
    }
    return user;
  }
}