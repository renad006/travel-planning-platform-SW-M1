import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/** FLT-01 (admin creates the airline profile). The logo is uploaded separately. */
export class CreateAirlineDto {
  @ApiProperty({ example: 'EgyptAir' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'MS', description: 'Airline code, 2-3 letters/digits' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]{2,3}$/, { message: 'iataCode must be 2-3 letters/digits' })
  iataCode: string;
}
