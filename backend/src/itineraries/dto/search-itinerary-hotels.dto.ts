import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, Min } from 'class-validator';

export class SearchItineraryHotelsDto {
  @ApiProperty({ description: 'The ID of any day inside the city group you want to book' })
  @IsMongoId()
  dayId: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt() @Min(1)
  guests: number;

  @ApiProperty({ example: 1, default: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1)
  rooms?: number;
}