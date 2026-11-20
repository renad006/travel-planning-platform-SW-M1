import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateFlightDto } from './create-flight.dto';

/**
 * FLT-05: times (local, like creation) and, only while the flight has no bookings, airports.
 * When airports change, departureTime and arrivalTime must be sent again.
 */
export class UpdateFlightDto extends PartialType(OmitType(CreateFlightDto, ['flightNumber', 'airlineId'] as const)) {}
