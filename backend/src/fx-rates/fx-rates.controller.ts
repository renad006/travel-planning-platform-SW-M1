import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ConvertQueryDto } from './dto/convert-query.dto';
import { FxRatesService } from './fx-rates.service';

/** ITN-18 (Member 3). These endpoints only read the cached rates; they never call the provider. */
@ApiTags('FX rates')
@Controller('fx-rates')
export class FxRatesController {
  constructor(private readonly service: FxRatesService) {}

  @Public()
  @Get('currencies')
  @ApiOperation({ summary: 'ITN-18: the supported currency list, with the date of the rates' })
  @ApiOkResponse({ description: 'Supported currency codes, the base currency and the rate date' })
  @ApiServiceUnavailableResponse({ description: 'No exchange rates have been fetched yet' })
  currencies() {
    return this.service.supportedCurrencies();
  }

  @Get('convert')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'ITN-18: convert an amount between two supported currencies' })
  @ApiOkResponse({ description: 'The converted amount, the rate used and the rate date' })
  @ApiBadRequestResponse({ description: 'Invalid amount, or a currency that is not supported' })
  @ApiUnauthorizedResponse({ description: 'Not logged in' })
  @ApiServiceUnavailableResponse({ description: 'No exchange rates have been fetched yet' })
  async convert(@Query() query: ConvertQueryDto) {
    for (const code of [query.from, query.to]) {
      if (!(await this.service.isSupported(code))) {
        throw new BadRequestException(`Currency ${code} is not supported`);
      }
    }
    return this.service.convert(query.amount, query.from, query.to);
  }
}
