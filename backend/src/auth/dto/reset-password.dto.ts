import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_REGEX,
  PASSWORD_RULE_MESSAGE,
} from '../../common/constants/password-rules';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from the reset email (ACC-07)' })
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  @MaxLength(200)
  token: string;

  @ApiProperty({
    example: 'NewPassw0rd1',
    description: PASSWORD_RULE_MESSAGE,
  })
  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_RULE_MESSAGE })
  newPassword: string;
}
