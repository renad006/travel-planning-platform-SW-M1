import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';
import { BookingType } from '../enums/payment.enums';

export class AcceptPolicyDto {
  @ApiProperty({
    enum: BookingType,
    description: 'PAY-02: which booking type this acceptance is for',
  })
  @IsEnum(BookingType)
  bookingType: BookingType;

  @ApiProperty({ description: 'PAY-02: the booking id' })
  @IsMongoId()
  bookingId: string;
}