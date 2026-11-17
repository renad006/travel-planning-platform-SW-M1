import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Blog - Authors')
@Controller('authors')
export class AuthorsController {
  constructor(private readonly blogService: BlogService) {}

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get public author profile (BLG-12)' })
  async getAuthor(
    @Param('id') id: string,
    @Query() dto: PaginationQueryDto,
  ) {
    return this.blogService.getAuthorProfile(id, dto);
  }
}