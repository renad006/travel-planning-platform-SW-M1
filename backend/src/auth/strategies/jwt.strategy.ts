import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  role: string;
}

export const ACCESS_TOKEN_COOKIE = 'access_token';

const cookieExtractor = (req: Request): string | null =>
  (req?.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  // Runs on every protected request: the user is re-loaded from the DB,
  // so suspension and deactivation take effect immediately.
  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    if (user.status === AccountStatus.SUSPENDED) {
      throw new UnauthorizedException('Account is suspended');
    }
    if (user.status === AccountStatus.DEACTIVATED) {
      throw new UnauthorizedException('Account is deactivated');
    }
    return user;
  }
}