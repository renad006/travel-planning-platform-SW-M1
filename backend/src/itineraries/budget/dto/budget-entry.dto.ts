import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';

export const BUDGET_CATEGORIES = [
  'food',
  'accommodation',
  'in-city-transport',
  'activities',
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** ITN-14: one budget entry of a day. */
export class CreateBudgetEntryDto {
  @ApiProperty({ enum: BUDGET_CATEGORIES, example: 'food' })
  @IsIn(BUDGET_CATEGORIES)
  category: BudgetCategory;

  @ApiProperty({ example: 25.5, description: 'Zero or more, at most 2 decimals' })
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
export class UpdateBudgetEntryDto {
  @ApiPropertyOptional({ enum: BUDGET_CATEGORIES })
  @IsOptional()
  @IsIn(BUDGET_CATEGORIES)
  category?: BudgetCategory;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000_000)
  amount?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @Transform(upper)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter currency code' })
  currency?: string;
}
