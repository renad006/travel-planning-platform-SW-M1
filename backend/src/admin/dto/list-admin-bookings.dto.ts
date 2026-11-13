import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { BookingType } from '../../payments/enums/payment.enums';

export class ListAdminBookingsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BookingType, description: 'ACC-17: filter by booking type' })
  @IsOptional()
  @IsEnum(BookingType)
  type?: BookingType;

  @ApiPropertyOptional({ enum: BookingStatus, description: 'ACC-17: filter by status' })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'ACC-17: bookings created on or after this date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'ACC-17: bookings created on or before this date' })
  @IsOptional()
  @IsDateString()
  to?: string;
}