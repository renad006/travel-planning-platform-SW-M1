import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// ACC-09: only name, phone and preferred currency can be edited
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Renad Elansary' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '+201001234567' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'Phone must be 7 to 15 digits, optionally starting with +',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: 'EUR',
    description: 'ISO 4217 currency code (3 letters)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{3}$/, {
    message: 'Preferred currency must be a 3-letter currency code',
  })
  preferredCurrency?: string;
}