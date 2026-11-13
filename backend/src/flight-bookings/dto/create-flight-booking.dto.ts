import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CabinClass } from '../../flights/schemas/cabin-inventory.schema';
import { PassengerType } from '../schemas/flight-booking.schema';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** One flight (and the cabin chosen on it). */
export class FlightLegDto {
  @ApiProperty({
    example: '665f1c2e8a1b2c3d4e5f6a7b',
    description: 'Flight id from the search results',
  })
  @IsMongoId()
  flightId: string;

  @ApiProperty({ enum: CabinClass, example: CabinClass.ECONOMY })
  @IsEnum(CabinClass)
  cabinClass: CabinClass;
}

/** FLT-19: one passenger. */
export class PassengerDto {
  @ApiProperty({
    enum: PassengerType,
    example: PassengerType.ADULT,
    description:
      'adult = 12+, child = 2-11, infant = under 2 on the departure date. ' +
      'The server checks this against the date of birth (FLT-12b).',
  })
  @IsEnum(PassengerType)
  type: PassengerType;

  @ApiProperty({ example: 'Sara Ahmed' })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  fullName: string;

  @ApiProperty({ example: '1995-04-12', description: 'YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD' })
  dateOfBirth: string;

  @ApiProperty({
    example: 'A1234567',
    description: 'Passport / ID number (4-20 letters or digits)',
  })
  @Transform(trimUpper)
  @Matches(/^[A-Z0-9]{4,20}$/, {
    message: 'passportNumber must be 4-20 letters or digits',
  })
  passportNumber: string;

  @ApiPropertyOptional({
    example: 1,
    default: 0,
    description: 'Extra bags, up to the airline maximum',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  extraBags?: number;

  @ApiPropertyOptional({
    example: 20,
    default: 0,
    description:
      'Total weight (kg) of the extra bags: at most extraBags x the cabin max weight per bag',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  extraBagWeightKg?: number;
}

/**
 * Body of POST /flight-bookings (summary, nothing reserved) and
 * POST /flight-bookings/hold (reserves seats for 10 minutes).
 */
export class CreateFlightBookingDto {
  @ApiProperty({ type: FlightLegDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => FlightLegDto)
  outbound: FlightLegDto;

  @ApiPropertyOptional({
    type: FlightLegDto,
    description:
      'Set for a round trip (FLT-12a): one booking, two segments, one payment, one reference',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FlightLegDto)
  return?: FlightLegDto;

  @ApiProperty({
    type: [PassengerDto],
    description: 'At least one adult; no more infants than adults',
    example: [
      {
        type: 'adult',
        fullName: 'Sara Ahmed',
        dateOfBirth: '1995-04-12',
        passportNumber: 'A1234567',
        extraBags: 1,
        extraBagWeightKg: 20,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(27)
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers: PassengerDto[];
}
