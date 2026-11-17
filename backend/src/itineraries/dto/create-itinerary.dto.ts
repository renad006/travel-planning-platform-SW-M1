import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateItineraryDto {
  @ApiProperty({ maxLength: 100, example: 'Summer in Europe' })
  @IsString() @MinLength(1) @MaxLength(100) title: string;

  @ApiProperty({ type: [String], example: ['Germany', 'France'], description: 'One or more countries' })
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) countries: string[];

  @ApiProperty({ example: '2026-06-01', format: 'date' })
  @IsDateString() startDate: string;
}