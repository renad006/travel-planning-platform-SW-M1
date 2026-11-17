import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateReviewDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'HTL-23: new rating from 1 to 5' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ maxLength: 1000, description: 'HTL-23: new review text, max 1000 characters' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  text?: string;
}