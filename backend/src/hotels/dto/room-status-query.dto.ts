import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

// HTL-08: the date range the moderator wants to inspect. `to` is the checkout day.
export class RoomStatusQueryDto {
    @ApiProperty({ example: '2026-12-01' })
    @IsDateString()
    from: string;

    @ApiProperty({ example: '2026-12-05' })
    @IsDateString()
    to: string;
}