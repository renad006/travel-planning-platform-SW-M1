import { Controller, Post, Body, Get, Query, Patch, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto'; // <--- ADDED
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { PaginationQueryDto } from './../common/dto/pagination-query.dto';
import { GetPostsDto } from './dto/get-posts.dto'; // <--- ADDED (for public route)
import { Public } from '../common/decorators/public.decorator'; // <--- ADDED (for public route)
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('Blog - Posts')
@Controller('posts')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

    @Get()
  @Public()
  @ApiOperation({ summary: 'Get published posts (BLG-02)' })
  async findAllPosts(@Query() dto: GetPostsDto) {
    return this.blogService.findAllPublished(dto);
  }

  @Get('mine')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get my own posts including drafts (BLG-03)' })
  async getMyPosts(
    @CurrentUser() user: UserDocument,
    @Query() dto: PaginationQueryDto,
  ) {
    return this.blogService.findMyPosts(user._id.toString(), dto);
  }

    @Patch(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Edit own post (BLG-04)' })
  async updatePost(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
    @Body() dto: UpdatePostDto,
  ) {
    return this.blogService.updatePost(id, user._id.toString(), dto);
  }
  @Delete(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Delete own post (BLG-04)' })
  async deletePost(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.blogService.deletePost(id, user._id.toString());
  }
  @Post()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create a post (BLG-01)' })
  async createPost(
    @CurrentUser() user: UserDocument,
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.blogService.createPost(user._id.toString(), createPostDto);
  }

    @Post(':id/comments')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Add a comment (BLG-05)' })
  async addComment(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateCommentDto,
  ) {
    return this.blogService.addComment(id, user._id.toString(), dto);
  }



 

  
}