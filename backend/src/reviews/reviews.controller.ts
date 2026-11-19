import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiCookieAuth('access_token')
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  @Post('hotel-bookings/:id/review')
  @ApiOperation({
    summary:
      'HTL-23: submit a rating (1-5) and optional review for a Completed reservation',
  })
  @ApiOkResponse({ description: 'Review created' })
  @ApiNotFoundResponse({ description: 'Reservation not found' })
  @ApiConflictResponse({
    description: 'Reservation is not Completed, or already has a review',
  })
  createReview(
    @CurrentUser() user: UserDocument,
    @Param('id') bookingId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.id, bookingId, dto);
  }

  @ApiCookieAuth('access_token')
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  @Patch('reviews/:id')
  @ApiOperation({ summary: 'HTL-23: edit your own review' })
  @ApiOkResponse({ description: 'Review updated' })
  @ApiNotFoundResponse({ description: 'Review not found' })
  updateReview(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(user.id, id, dto);
  }

  @ApiCookieAuth('access_token')
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  @Delete('reviews/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'HTL-23: delete your own review' })
  @ApiNoContentResponse({ description: 'Review deleted' })
  @ApiNotFoundResponse({ description: 'Review not found' })
  deleteReview(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.reviewsService.remove(user.id, id);
  }

  @Public()
  @Get('hotels/:id/reviews')
  @ApiOperation({
    summary:
      "HTL-24: a hotel's average rating, rating count and reviews (newest first, paginated)",
  })
  @ApiOkResponse({ description: 'Average rating, rating count and paginated reviews' })
  @ApiNotFoundResponse({ description: 'Hotel not found' })
  listReviews(
    @Param('id') hotelId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.reviewsService.listForHotel(hotelId, query);
  }

  @ApiCookieAuth('access_token')
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  @Post('reviews/:id/reply')
  @ApiOperation({ summary: 'HTL-26 (Bonus): hotel moderator replies to a review' })
  @ApiOkResponse({ description: 'Reply added' })
  @ApiNotFoundResponse({ description: 'Review not found' })
  @ApiForbiddenResponse({ description: "Not the hotel's own moderator" })
  replyToReview(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviewsService.reply(user, id, dto);
  }
}