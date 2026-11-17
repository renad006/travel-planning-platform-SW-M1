import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { GetPostsDto } from './dto/get-posts.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Blog - Tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly blogService: BlogService) {}

  @Get(':tag/posts')
  @Public()
  @ApiOperation({ summary: 'Get published posts by tag (BLG-08)' })
  async getPostsByTag(
    @Param('tag') tag: string,
    @Query() dto: GetPostsDto,
  ) {
    // Force the tag parameter to be the one from the URL
    dto.tag = tag;
    return this.blogService.findAllPublished(dto);
  }
}