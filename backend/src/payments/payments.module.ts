import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightBookingsModule } from '../flight-bookings/flight-bookings.module';
import { HotelBookingsModule } from '../hotel-bookings/hotel-bookings.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import {
  PolicyAcceptance,
  PolicyAcceptanceSchema,
} from './schemas/policy-acceptance.schema';
import {
  ProcessedStripeEvent,
  ProcessedStripeEventSchema,
} from './schemas/processed-stripe-event.schema';
import { Refund, RefundSchema } from './schemas/refund.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: PolicyAcceptance.name, schema: PolicyAcceptanceSchema },
      { name: Refund.name, schema: RefundSchema },
      {
        name: ProcessedStripeEvent.name,
        schema: ProcessedStripeEventSchema,
      },
    ]),
    FlightBookingsModule,
    HotelBookingsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}