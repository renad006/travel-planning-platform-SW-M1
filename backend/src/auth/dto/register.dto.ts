import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_REGEX,
  PASSWORD_RULE_MESSAGE,
} from '../../common/constants/password-rules';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @ApiProperty({ example: 'Renad Elansary' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'renad@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email is invalid' })
  email: string;

  @ApiProperty({
    example: 'Passw0rdOK',
    description: PASSWORD_RULE_MESSAGE,
  })
  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_RULE_MESSAGE })
  password: string;

  @ApiProperty({
    example: true,
    description: 'Terms-and-privacy consent (must be true)',
  })
  @Equals(true, { message: 'You must accept the terms and privacy policy' })
  acceptedTerms: boolean;
}