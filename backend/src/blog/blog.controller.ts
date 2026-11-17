import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Blog - Posts')
@Controller('posts')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create a post (BLG-01)' })
  async createPost(
    @CurrentUser() user: UserDocument,
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.blogService.createPost(user._id.toString(), createPostDto);
  }
}