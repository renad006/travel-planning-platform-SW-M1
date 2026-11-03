import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserDocument } from '../../users/schemas/user.schema';

export const CurrentUser = createParamDecorator(
  (data: keyof UserDocument | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: UserDocument }>();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);