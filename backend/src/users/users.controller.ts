import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccountStatus } from '../common/enums/account-status.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiCookieAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my profile (ACC-11)' })
  getMe(@CurrentUser() user: UserDocument) {
    return user;
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Edit my name, phone and preferred currency (ACC-09)',
  })
  async updateMe(
    @CurrentUser() user: UserDocument,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateById(user.id, dto);
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return updated;
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate my own account (ACC-12)' })
  async deactivateMe(@CurrentUser() user: UserDocument): Promise<void> {
    // Access and refresh tokens stop working at once because both check status.
    await this.usersService.updateById(user.id, {
      status: AccountStatus.DEACTIVATED,
    });
  }
}