import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ListCitiesDto } from './dto/list-cities.dto';
import { ReferenceDataService } from './reference-data.service';

@ApiTags('Reference data')
@Controller()
export class ReferenceDataController {
  constructor(private readonly service: ReferenceDataService) {}

  @Public()
  @Get('countries')
  @ApiOperation({
    summary: 'GEN-12: list all countries',
    description:
      'Public. Returns code, name and currency of every seeded country, sorted by name. Not paginated: used for dropdowns.',
  })
  @ApiOkResponse({ description: 'All countries (GEN-12)' })
  countries() {
    return this.service.findCountries();
  }

  @Public()
  @Get('cities')
  @ApiOperation({
    summary: 'GEN-12: list cities, optionally of one country',
    description:
      'Public. Returns cityId, name and countryCode, sorted by name. Use countryCode to filter. Not paginated: used for dropdowns.',
  })
  @ApiOkResponse({ description: 'Cities (GEN-12)' })
  cities(@Query() query: ListCitiesDto) {
    return this.service.findCities(query.countryCode);
  }
}