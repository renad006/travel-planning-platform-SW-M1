import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCabinDto {
  @ApiProperty({ example: 180, description: 'The new total number of seats for this cabin' })
  @IsNumber()
  @Min(0)
  totalSeats: number;
}