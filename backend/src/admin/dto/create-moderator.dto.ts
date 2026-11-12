import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// ACC-13: admin creates a moderator linked to exactly one provider
export class CreateModeratorDto {
  @ApiProperty({ example: 'Sara Ahmed' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'moderator@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email is invalid' })
  email: string;

  @ApiProperty({
    enum: [Role.AIRLINE_MODERATOR, Role.HOTEL_MODERATOR],
    example: Role.AIRLINE_MODERATOR,
  })
  @IsIn([Role.AIRLINE_MODERATOR, Role.HOTEL_MODERATOR], {
    message: 'Role must be airline_moderator or hotel_moderator',
  })
  role: Role.AIRLINE_MODERATOR | Role.HOTEL_MODERATOR;

  @ApiProperty({
    description: 'Id of the existing airline or hotel this moderator manages',
    example: '64f1a2b3c4d5e6f7a8b9c0d1',
  })
  @IsMongoId({ message: 'providerId must be a valid id' })
  providerId: string;
}