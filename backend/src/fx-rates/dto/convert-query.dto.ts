import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNumber, Matches, Max, Min } from 'class-validator';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** ITN-18: convert one amount between two supported currencies. */
export class ConvertQueryDto {
  @ApiProperty({ example: 100, description: 'Zero or more' })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000_000_000)
  amount: number;

  @ApiProperty({ example: 'EUR', description: '3-letter currency code' })
  @Transform(upper)
  @Matches(/^[A-Z]{3}$/, { message: 'from must be a 3-letter currency code' })
  from: string;

  @ApiProperty({ example: 'USD', description: '3-letter currency code' })
  @Transform(upper)
  @Matches(/^[A-Z]{3}$/, { message: 'to must be a 3-letter currency code' })
  to: string;
}
