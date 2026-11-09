import { IsString, IsNotEmpty, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCabinDto {
  @ApiProperty({ example: 'Economy', enum: ['Economy', 'Business'] })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['Economy', 'Business'])
  cabinClass: string;

  @ApiProperty({ example: 150 })
  @IsNumber()
  @IsNotEmpty()
  totalSeats: number;

  @ApiProperty({ example: 250 })
  @IsNumber()
  @IsNotEmpty()
  price: number;
}