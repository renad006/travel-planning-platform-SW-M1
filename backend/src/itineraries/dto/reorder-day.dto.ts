import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ReorderDayDto {
  @ApiProperty({ example: 2, description: 'The new position (1-indexed) for this day' })
  @IsInt()
  @Min(1)
  newDayNumber: number;
}