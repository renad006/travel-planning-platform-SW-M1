import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'renad@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Invalid email or password' })
  email: string;

  @ApiProperty({ example: 'Passw0rdOK' })
  @IsString({ message: 'Invalid email or password' })
  @IsNotEmpty({ message: 'Invalid email or password' })
  password: string;
}