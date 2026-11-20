import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsPositive,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

// HTL-03: moderator adds a room to their hotel
export class CreateRoomDto {
    @ApiProperty({ example: '101' })
    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    name: string;

    @ApiProperty({ example: 'Double' })
    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    type: string;

    @ApiProperty({ example: 2, minimum: 1 })
    @IsInt()
    @Min(1)
    beds: number;

    @ApiProperty({ example: 2, minimum: 1 })
    @IsInt()
    @Min(1)
    maxOccupancy: number;

    @ApiProperty({ example: 120.5, description: 'Price per night, above 0' })
    @IsNumber()
    @IsPositive()
    pricePerNight: number;
}