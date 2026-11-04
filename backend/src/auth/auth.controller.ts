import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { AuthService, REFRESH_TOKEN_COOKIE } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const refreshCookieOf = (req: Request): string | undefined =>
  (req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined) ?? undefined;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user account (ACC-01)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Log in with email and password; tokens are set as httpOnly cookies (ACC-04, ACC-05, ACC-19)',
  })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Issue a new access and refresh token from the refresh cookie (ACC-06, ACC-19)',
  })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.refresh(refreshCookieOf(req), res);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Log out: clears the cookies and revokes the refresh token on the server (ACC-06)',
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(refreshCookieOf(req), res);
  }

  @Patch('change-password')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Change the current password (ACC-08)' })
  changePassword(
    @CurrentUser() user: UserDocument,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.changePassword(user, dto, res);
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Return the currently logged-in user (ACC-04, ACC-19)',
  })
  me(@CurrentUser() user: UserDocument) {
    return user;
  }
}