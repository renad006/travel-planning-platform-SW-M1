import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateItineraryDayDto {
  @ApiProperty({ example: 'Berlin', description: 'City from the predefined list' })
  @IsString()
  @MinLength(1)
  city: string;

  @ApiProperty({ example: 'Check into hotel and visit the TV Tower', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}