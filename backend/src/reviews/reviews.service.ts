import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { buildPaginatedResponse, getSkip } from '../common/utils/pagination.helper';
import { ProviderType } from '../common/enums/provider-type.enum';
import { Role } from '../common/enums/role.enum';
import { HotelBooking, HotelBookingDocument } from '../hotel-bookings/schemas/hotel-booking.schema';
import { Hotel, HotelDocument } from '../hotels/schemas/hotel.schema';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review, ReviewDocument } from './schemas/review.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Hotel.name) private readonly hotelModel: Model<HotelDocument>,
    @InjectModel(HotelBooking.name)
    private readonly hotelBookingModel: Model<HotelBookingDocument>,
  ) {}

  // HTL-23: submit a review for a Completed reservation
  async create(userId: string, bookingId: string, dto: CreateReviewDto) {
    const booking = await this.hotelBookingModel.findById(bookingId).exec();
    if (!booking || booking.userId.toString() !== userId) {
      throw new NotFoundException('Reservation not found');
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ConflictException(
        'Only a completed reservation can be reviewed',
      );
    }

    try {
      const review = await this.reviewModel.create({
        bookingId: booking._id,
        hotelId: booking.hotelId,
        userId,
        rating: dto.rating,
        text: dto.text,
      });
      await this.recalcHotelRating(booking.hotelId);
      return review;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException(
          'This reservation has already been reviewed',
        );
      }
      throw err;
    }
  }

  // HTL-23: edit your own review
  async update(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.reviewModel.findById(reviewId).exec();
    if (!review || review.userId.toString() !== userId) {
      throw new NotFoundException('Review not found');
    }
    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.text !== undefined) review.text = dto.text;
    await review.save();
    await this.recalcHotelRating(review.hotelId);
    return review;
  }

  // HTL-23: delete your own review
  async remove(userId: string, reviewId: string) {
    const review = await this.reviewModel.findById(reviewId).exec();
    if (!review || review.userId.toString() !== userId) {
      throw new NotFoundException('Review not found');
    }
    await review.deleteOne();
    await this.recalcHotelRating(review.hotelId);
  }

  // HTL-24: a hotel's average rating, rating count and reviews, newest first
  async listForHotel(hotelId: string, query: PaginationQueryDto) {
    const hotel = await this.hotelModel.findById(hotelId).exec();
    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    const filter = { hotelId: new Types.ObjectId(hotelId) };
    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(getSkip(query))
        .limit(query.limit)
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
    ]);

    return {
      avgRating: hotel.avgRating,
      ratingCount: hotel.ratingCount,
      reviews: buildPaginatedResponse(items, total, query),
    };
  }

  // HTL-26 (Bonus): the hotel's own moderator replies to a review
  async reply(moderator: UserDocument, reviewId: string, dto: ReplyReviewDto) {
    const review = await this.reviewModel.findById(reviewId).exec();
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const allowed =
      moderator.role === Role.ADMIN ||
      (moderator.role === Role.HOTEL_MODERATOR &&
        moderator.assignedProviderType === ProviderType.HOTEL &&
        !!moderator.assignedProviderId &&
        moderator.assignedProviderId.toString() === review.hotelId.toString());

    if (!allowed) {
      throw new ForbiddenException(
        'You can only manage your own assigned provider',
      );
    }

    review.reply = { text: dto.text, repliedAt: new Date() };
    await review.save();
    return review;
  }

  private async recalcHotelRating(hotelId: Types.ObjectId | string) {
    const [result] = await this.reviewModel.aggregate([
      { $match: { hotelId: new Types.ObjectId(hotelId.toString()) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    await this.hotelModel
      .updateOne(
        { _id: hotelId },
        {
          avgRating: result ? Math.round(result.avg * 100) / 100 : null,
          ratingCount: result ? result.count : 0,
        },
      )
      .exec();
  }
}