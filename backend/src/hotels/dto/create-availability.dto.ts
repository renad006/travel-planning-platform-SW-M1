import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

// HTL-04: endDate is the checkout day
export class CreateAvailabilityDto {
    @ApiProperty({ example: '2026-12-01', description: 'First bookable night' })
    @IsDateString()
    startDate: string;

    @ApiProperty({ example: '2026-12-10', description: 'Checkout day' })
    @IsDateString()
    endDate: string;
}