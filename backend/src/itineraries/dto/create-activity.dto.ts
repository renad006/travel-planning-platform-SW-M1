import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateActivityDto {
  @ApiProperty({ example: 'Visit the Brandenburg Gate' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'Walk around and take photos', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '14:00', required: false, description: 'Local time' })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiProperty({ example: 15.5, required: false, description: 'Optional cost' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiProperty({ example: 'EUR', required: false })
  @IsOptional()
  @IsString()
  currency?: string;
}