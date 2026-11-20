import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** ITN-14 / ITN-18: the budget summary query. */
export class BudgetSummaryQueryDto {
  @ApiPropertyOptional({
    example: 'EGP',
    description: "3-letter currency code. Default: the user's preferred currency",
  })
  @IsOptional()
  @Transform(upper)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter currency code' })
  currency?: string;
}
