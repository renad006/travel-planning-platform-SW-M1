import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BookingType } from './enums/payment.enums';
import {
  PAYABLE_FLIGHT_BOOKINGS,
  PAYABLE_HOTEL_BOOKINGS,
} from './payable-booking.interface';
import type { PayableBookingService } from './payable-booking.interface';
import {
  PolicyAcceptance,
  PolicyAcceptanceDocument,
} from './schemas/policy-acceptance.schema';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(PolicyAcceptance.name)
    private readonly policyAcceptanceModel: Model<PolicyAcceptanceDocument>,
    @Inject(PAYABLE_FLIGHT_BOOKINGS)
    private readonly flightBookings: PayableBookingService,
    @Inject(PAYABLE_HOTEL_BOOKINGS)
    private readonly hotelBookings: PayableBookingService,
  ) {}

  private bookingServiceFor(type: BookingType): PayableBookingService {
    return type === BookingType.FLIGHT
      ? this.flightBookings
      : this.hotelBookings;
  }

  // PAY-02: record that the user has seen and accepted the booking's policies
  async acceptPolicies(
    userId: string,
    bookingType: BookingType,
    bookingId: string,
  ) {
    const bookingService = this.bookingServiceFor(bookingType);
    const booking = await bookingService.findPayable(bookingId);

    // no separate ownership check in the interface, so Payments enforces it here
    if (booking.ownerId !== userId) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.policiesAcceptedAt) {
      throw new ConflictException(
        'Policies already accepted for this booking',
      );
    }

    const acceptedAt = new Date();

    try {
      await this.policyAcceptanceModel.create({
        bookingType,
        bookingId,
        userId,
        acceptedAt,
        policySnapshot: booking.policySnapshot,
      });
    } catch (err) {
      // unique index (bookingType, bookingId, userId): a concurrent accept race
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException(
          'Policies already accepted for this booking',
        );
      }
      throw err;
    }

    await bookingService.markPoliciesAccepted(bookingId, acceptedAt);

    return { bookingType, bookingId, acceptedAt };
  }
}