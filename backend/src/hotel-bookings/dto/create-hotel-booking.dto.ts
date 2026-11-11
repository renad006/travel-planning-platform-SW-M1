import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BookedRoomDto {
  @ApiProperty({ example: '6aef74b6b16024a52878ead3' })
  @IsMongoId()
  roomId: string;

  @ApiProperty({ example: 2, minimum: 0 })
  @IsInt()
  @Min(0)
  adults: number;

  @ApiPropertyOptional({ example: [5, 9], type: [Number], description: 'Ages 0 to 17' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(17, { each: true })
  childrenAges?: number[];
}

// HTL-16: one reservation for one or more rooms of the same hotel and dates
export class CreateHotelBookingDto {
  @ApiProperty({ example: '6aef74b6b16024a52878ead3' })
  @IsMongoId()
  hotelId: string;

  @ApiProperty({ example: '2026-12-01' })
  @IsDateString()
  checkIn: string;

  @ApiProperty({ example: '2026-12-05', description: 'Checkout day' })
  @IsDateString()
  checkOut: string;

  @ApiProperty({ type: [BookedRoomDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BookedRoomDto)
  rooms: BookedRoomDto[];
}
