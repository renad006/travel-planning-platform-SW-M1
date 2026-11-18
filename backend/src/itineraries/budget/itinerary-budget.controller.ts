import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserDocument } from '../../users/schemas/user.schema';
import { ItineraryBudgetService } from './itinerary-budget.service';
import { BudgetSummaryQueryDto } from './dto/budget-summary-query.dto';
import { CreateBudgetEntryDto, UpdateBudgetEntryDto } from './dto/budget-entry.dto';
import {
  CreateTransportCostDto,
  UpdateTransportCostDto,
} from './dto/transport-cost.dto';

/**
 * Member 3: budget entries (ITN-14) and intercity transport costs (ITN-16) of an itinerary day.
 * The day, its entries and costs are all returned by Member 6's GET /itineraries/:id.
 */
@ApiTags('Itinerary budget')
@ApiCookieAuth('access_token')
@ApiUnauthorizedResponse({ description: 'Not logged in' })
@ApiNotFoundResponse({ description: 'Not found, or the itinerary is not yours' })
@Controller('itineraries')
export class ItineraryBudgetController {
  constructor(private readonly service: ItineraryBudgetService) {}

  // ---------------- budget summary ----------------
  @Get(':id/budget-summary')
  @ApiOperation({
    summary:
      'ITN-14 / ITN-18: budget totals of the itinerary by category and by day, converted into one currency',
  })
  @ApiOkResponse({
    description:
      'Totals in the chosen currency with the exchange-rate date. Amounts with no rate or no currency are listed in "unconverted", never guessed',
  })
  @ApiBadRequestResponse({ description: 'No exchange rates for the requested currency' })
  getBudgetSummary(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Query() query: BudgetSummaryQueryDto,
  ) {
    return this.service.getBudgetSummary(user._id.toString(), id, query.currency, user.preferredCurrency);
  }

  // ---------------- budget entries ----------------
  @Post(':id/days/:dayId/budget-entries')
  @ApiOperation({ summary: 'ITN-14: add a budget entry (food, accommodation, in-city transport, activities) to a day' })
  @ApiCreatedResponse({ description: 'Budget entry added' })
  @ApiBadRequestResponse({ description: 'Invalid category, negative amount or bad currency' })
  @ApiConflictResponse({ description: 'The day already has 50 budget entries' })
  addBudgetEntry(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Body() dto: CreateBudgetEntryDto,
  ) {
    return this.service.addBudgetEntry(user._id.toString(), id, dayId, dto);
  }

  @Patch(':id/days/:dayId/budget-entries/:entryId')
  @ApiOperation({ summary: 'ITN-14: edit a budget entry' })
  @ApiOkResponse({ description: 'Budget entry updated' })
  @ApiBadRequestResponse({ description: 'Nothing to change, or an invalid value' })
  @ApiConflictResponse({ description: 'The entry comes from a linked booking (ITN-27): unlink the booking instead' })
  updateBudgetEntry(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateBudgetEntryDto,
  ) {
    return this.service.updateBudgetEntry(user._id.toString(), id, dayId, entryId, dto);
  }

  @Delete(':id/days/:dayId/budget-entries/:entryId')
  @HttpCode(200)
  @ApiOperation({ summary: 'ITN-14: delete a budget entry' })
  @ApiOkResponse({ description: 'Budget entry deleted' })
  @ApiConflictResponse({ description: 'The entry comes from a linked booking (ITN-27): unlink the booking instead' })
  deleteBudgetEntry(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.service.deleteBudgetEntry(user._id.toString(), id, dayId, entryId);
  }

  // ---------------- transport costs ----------------
  @Post(':id/days/:dayId/transport-costs')
  @ApiOperation({ summary: 'ITN-16: add an intercity transport cost (mode, from, to, amount, currency) to a day' })
  @ApiCreatedResponse({ description: 'Transport cost added' })
  @ApiBadRequestResponse({ description: 'Missing field, negative amount or bad currency' })
  @ApiConflictResponse({ description: 'The day already has 50 transport costs' })
  addTransportCost(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Body() dto: CreateTransportCostDto,
  ) {
    return this.service.addTransportCost(user._id.toString(), id, dayId, dto);
  }

  @Patch(':id/days/:dayId/transport-costs/:costId')
  @ApiOperation({ summary: 'ITN-16: edit a transport cost' })
  @ApiOkResponse({ description: 'Transport cost updated' })
  @ApiBadRequestResponse({ description: 'Nothing to change, or an invalid value' })
  updateTransportCost(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Param('costId') costId: string,
    @Body() dto: UpdateTransportCostDto,
  ) {
    return this.service.updateTransportCost(user._id.toString(), id, dayId, costId, dto);
  }

  @Delete(':id/days/:dayId/transport-costs/:costId')
  @HttpCode(200)
  @ApiOperation({ summary: 'ITN-16: delete a transport cost' })
  @ApiOkResponse({ description: 'Transport cost deleted' })
  deleteTransportCost(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Param('costId') costId: string,
  ) {
    return this.service.deleteTransportCost(user._id.toString(), id, dayId, costId);
  }
}
