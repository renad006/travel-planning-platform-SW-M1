import { IsString, IsNotEmpty, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FlightStatus } from '../schemas/flight.schema';

export class CreateFlightDto {
  @ApiProperty({ example: 'MS-777' })
  @IsString()
  @IsNotEmpty()
  flightNumber: string;

  @ApiProperty({ example: '6a6fc29e5ec1356c91724bab' })
  @IsString()
  @IsNotEmpty()
  airlineId: string;

  @ApiProperty({ example: 'CAI' })
  @IsString()
  @IsNotEmpty()
  originAirport: string;

  @ApiProperty({ example: 'DXB' })
  @IsString()
  @IsNotEmpty()
  destinationAirport: string;

  @ApiProperty({ example: '2026-12-20T10:00:00Z' })
  @IsDateString()
  departureTime: string;

  @ApiProperty({ example: '2026-12-20T14:00:00Z' })
  @IsDateString()
  arrivalTime: string;

  @ApiProperty({ example: 'Scheduled', required: false })
  @IsOptional()
  @IsEnum(FlightStatus)
  status?: FlightStatus;
}