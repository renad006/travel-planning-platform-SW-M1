import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';
import { BookingType } from '../enums/payment.enums';

export class CreatePaymentDto {
  @ApiProperty({
    enum: BookingType,
    description: 'PAY-01: which booking type this payment is for',
  })
  @IsEnum(BookingType)
  bookingType: BookingType;

  @ApiProperty({ description: 'PAY-01: the booking id' })
  @IsMongoId()
  bookingId: string;
}