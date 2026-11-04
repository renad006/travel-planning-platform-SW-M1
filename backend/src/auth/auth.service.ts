import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { compare, hash } from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type { CookieOptions, Response } from 'express';
import { Model } from 'mongoose';
import { AccountStatus } from '../common/enums/account-status.enum';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schemas/refresh-token.schema';
import { ACCESS_TOKEN_COOKIE } from './strategies/jwt.strategy';

export const REFRESH_TOKEN_COOKIE = 'refresh_token';
// The refresh cookie is only sent to the auth endpoints
export const REFRESH_COOKIE_PATH = '/api/auth';

const BCRYPT_ROUNDS = 10;
const MAX_FAILED_LOGINS = 5; // ACC-05
const LOCK_MINUTES = 15; // ACC-05
const INVALID_CREDENTIALS = 'Invalid email or password'; // ACC-04
const SESSION_EXPIRED = 'Session expired, please log in again';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectModel(RefreshToken.name)
    private readonly refreshModel: Model<RefreshTokenDocument>,
  ) {}

  // ACC-01
  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const password = await hash(dto.password, BCRYPT_ROUNDS);
    try {
      return await this.usersService.create({
        name: dto.name,
        email: dto.email,
        password,
        termsAcceptedAt: new Date(),
      });
    } catch (error) {
      // Two requests with the same email at the same moment
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  // ACC-04, ACC-05
  async login(dto: LoginDto, res: Response) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const now = new Date();
    if (user.lockUntil && user.lockUntil > now) {
      throw new ForbiddenException(this.lockMessage(user.lockUntil, now));
    }
    if (user.lockUntil) {
      // The lock has expired: start counting from zero again
      await this.usersService.updateById(user.id, {
        failedLoginCount: 0,
        lockUntil: null,
      });
      user.failedLoginCount = 0;
    }

    const passwordMatches = await compare(dto.password, user.password);
    if (!passwordMatches) {
      await this.registerFailedLogin(user.id);
    }

    if (user.status === AccountStatus.SUSPENDED) {
      throw new ForbiddenException('Your account is suspended');
    }
    if (user.status === AccountStatus.DEACTIVATED) {
      throw new ForbiddenException('Your account is deactivated');
    }

    // A successful login resets the counter
    if (user.failedLoginCount > 0) {
      await this.usersService.updateById(user.id, {
        failedLoginCount: 0,
        lockUntil: null,
      });
    }

    await this.issueTokens(user, res);
    return user;
  }

  // ACC-06, ACC-19: rotate the refresh token and issue a fresh pair
  async refresh(rawRefreshToken: string | undefined, res: Response) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    // Atomic: a refresh token can be used only once
    const stored = await this.refreshModel
      .findOneAndDelete({
        tokenHash: this.hashToken(rawRefreshToken),
        expiresAt: { $gt: new Date() },
      })
      .exec();
    if (!stored) {
      this.clearCookies(res);
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    const user = await this.usersService.findById(stored.userId.toString());
    if (!user || user.status !== AccountStatus.ACTIVE) {
      this.clearCookies(res);
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    await this.issueTokens(user, res);
    return user;
  }

  // ACC-06: clear the cookies and revoke the refresh token on the server
  async logout(rawRefreshToken: string | undefined, res: Response) {
    if (rawRefreshToken) {
      await this.refreshModel
        .deleteOne({ tokenHash: this.hashToken(rawRefreshToken) })
        .exec();
    }
    this.clearCookies(res);
  }

  // ACC-08
  async changePassword(
    user: UserDocument,
    dto: ChangePasswordDto,
    res: Response,
  ) {
    const current = await this.usersService.findByIdWithPassword(user.id);
    if (!current) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    if (!(await compare(dto.currentPassword, current.password))) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (await compare(dto.newPassword, current.password)) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const password = await hash(dto.newPassword, BCRYPT_ROUNDS);
    const updated = await this.usersService.updateById(user.id, {
      password,
      mustChangePassword: false,
    });
    if (!updated) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    // Sign out every other session, then start a fresh one
    await this.refreshModel.deleteMany({ userId: user._id }).exec();
    await this.issueTokens(updated, res);
    return { message: 'Password changed successfully' };
  }

  private async registerFailedLogin(userId: string): Promise<never> {
    const updated = await this.usersService.updateById(userId, {
      $inc: { failedLoginCount: 1 },
    });
    if (updated && updated.failedLoginCount >= MAX_FAILED_LOGINS) {
      const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
      await this.usersService.updateById(userId, { lockUntil });
      throw new ForbiddenException(this.lockMessage(lockUntil, new Date()));
    }
    throw new UnauthorizedException(INVALID_CREDENTIALS);
  }

  private lockMessage(lockUntil: Date, now: Date): string {
    const minutes = Math.max(
      1,
      Math.ceil((lockUntil.getTime() - now.getTime()) / 60_000),
    );
    return `Too many failed login attempts. Account locked, try again in ${minutes} minute(s)`;
  }

  private async issueTokens(user: UserDocument, res: Response) {
    const accessMinutes = this.config.getOrThrow<number>(
      'jwt.accessExpiresMinutes',
    );
    const refreshMinutes = this.config.getOrThrow<number>(
      'jwt.refreshExpiresMinutes',
    );

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, role: user.role },
      { expiresIn: accessMinutes * 60 },
    );

    // Opaque random token: only its SHA-256 hash is stored in the database
    const refreshToken = randomBytes(48).toString('hex');
    await this.refreshModel.create({
      userId: user._id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshMinutes * 60_000),
    });

    res.cookie(
      ACCESS_TOKEN_COOKIE,
      accessToken,
      this.cookieOptions(accessMinutes * 60_000, '/'),
    );
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      this.cookieOptions(refreshMinutes * 60_000, REFRESH_COOKIE_PATH),
    );
  }

  private clearCookies(res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions(undefined, '/'));
    res.clearCookie(
      REFRESH_TOKEN_COOKIE,
      this.cookieOptions(undefined, REFRESH_COOKIE_PATH),
    );
  }

  // ACC-19: httpOnly + Secure + SameSite
  private cookieOptions(
    maxAge: number | undefined,
    path: string,
  ): CookieOptions {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path,
      ...(maxAge !== undefined ? { maxAge } : {}),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}