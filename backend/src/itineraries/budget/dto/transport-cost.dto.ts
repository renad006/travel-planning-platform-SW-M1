import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** ITN-16: an intercity transport cost of a day. */
export class CreateTransportCostDto {
  @ApiProperty({ example: 'train', description: 'For example flight, train, bus, car' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  mode: string;

  @ApiProperty({ example: 'Berlin' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fromCity: string;

  @ApiProperty({ example: 'Munich' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  toCity: string;

  @ApiProperty({ example: 79.9, description: 'Zero or more, at most 2 decimals' })
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000_000)
  amount: number;

  @ApiProperty({ example: 'EUR', description: '3-letter currency code' })
  @Transform(upper)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter currency code' })
  currency: string;
}

/** All fields optional, at least one must be sent (checked in the service). */
export class UpdateTransportCostDto {
  @ApiPropertyOptional({ example: 'bus' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  mode?: string;

  @ApiPropertyOptional({ example: 'Berlin' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fromCity?: string;

  @ApiPropertyOptional({ example: 'Munich' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  toCity?: string;

  @ApiPropertyOptional({ example: 59 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000_000)
  amount?: number;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @Transform(upper)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter currency code' })
  currency?: string;
}
