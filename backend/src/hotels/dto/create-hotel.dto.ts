import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsArray,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

// HTL-01: admin creates a hotel profile
export class CreateHotelDto {
    @ApiProperty({ example: 'Nile View Hotel' })
    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty({ example: '12 Corniche El Nile' })
    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    address: string;

    @ApiProperty({ example: 'CAI', description: 'City identifier' })
    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    cityId: string;

    @ApiProperty({ example: 'EG', description: 'Country code' })
    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    countryCode: string;

    @ApiPropertyOptional({ example: 'A riverside hotel in the city centre' })
    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(5)
    starClass?: number;

    @ApiPropertyOptional({ example: ['WiFi', 'Pool'], type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    amenities?: string[];
}