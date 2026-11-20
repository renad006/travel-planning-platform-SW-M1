import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsMongoId, IsOptional, Matches } from 'class-validator';

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;
const LOCAL_MSG = 'must be a LOCAL date-time without timezone, e.g. 2026-12-20T10:00';
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
// "MS 777", "ms-777" and "MS777" are the same flight number -> stored as "MS777"
// (otherwise the FLT-03 duplicate rule could be bypassed with a space or a dash)
const flightNo = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() : value;

/**
 * FLT-03. For an Airline Moderator the airline comes from their own assignment and
 * `airlineId` below is ignored even if sent. Only an Admin may (and must) send
 * `airlineId` explicitly, per the team's role plan.
 * Times are entered in each airport's LOCAL time and stored in UTC by the service.
 */
export class CreateFlightDto {
  @ApiPropertyOptional({
    description: 'Admin only: which airline this flight belongs to. Ignored for moderators.',
    example: '6af42363fcdac02530528a6d',
  })
  @IsOptional()
  @IsMongoId()
  airlineId?: string;

  @ApiProperty({ example: 'MS777', description: '2-8 letters/digits (spaces and dashes are removed)' })
  @Transform(flightNo)
  @Matches(/^[A-Z0-9]{2,8}$/, { message: 'flightNumber must be 2-8 letters/digits, e.g. MS777' })
  flightNumber: string;

  @ApiProperty({ example: 'CAI', description: 'IATA code from GET /api/airports' })
  @Transform(upper)
  @Matches(/^[A-Z]{3}$/, { message: 'originAirport must be a 3-letter IATA code' })
  originAirport: string;

  @ApiProperty({ example: 'DXB', description: 'IATA code from GET /api/airports' })
  @Transform(upper)
  @Matches(/^[A-Z]{3}$/, { message: 'destinationAirport must be a 3-letter IATA code' })
  destinationAirport: string;

  @ApiProperty({ example: '2026-12-20T10:00', description: 'Local time at the ORIGIN airport' })
  @Matches(LOCAL_DATE_TIME, { message: `departureTime ${LOCAL_MSG}` })
  departureTime: string;

  @ApiProperty({ example: '2026-12-20T14:30', description: 'Local time at the DESTINATION airport' })
  @Matches(LOCAL_DATE_TIME, { message: `arrivalTime ${LOCAL_MSG}` })
  arrivalTime: string;
}