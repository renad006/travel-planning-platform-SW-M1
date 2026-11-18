import { Controller, Post, Body, Get, Query, Patch, Delete, Param , UseGuards } from '@nestjs/common';
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
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AttachItineraryDto } from './dto/attach-itinerary.dto';
import { OptionalAuthGuard } from './guards/optional-auth.guard';

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

    @Get(':id')
  @Public()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get a single post by ID (BLG-02)' })
  async getPostById(
    @Param('id') id: string,
    @CurrentUser() user?: UserDocument, 
  ) {
    return this.blogService.getPostById(id, user?._id?.toString());
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

    @Post(':id/like')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Like a post (BLG-06)' })
  async likePost(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.blogService.likePost(id, user._id.toString());
  }

  @Delete(':id/like')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Unlike a post (BLG-06)' })
  async unlikePost(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.blogService.unlikePost(id, user._id.toString());
  }

    @Post(':id/images')
  @ApiCookieAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload an image for a post (BLG-10)' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.blogService.addImageToPost(id, user._id.toString(), file);
  }

  @Delete(':id/images/:imageId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Delete an image from a post (BLG-10)' })
  async deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.blogService.deleteImageFromPost(id, imageId, user._id.toString());
  }

    @Patch(':id/itinerary')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Attach an itinerary to a post (BLG-13)' })
  async attachItinerary(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
    @Body() dto: AttachItineraryDto,
  ) {
    return this.blogService.attachItinerary(id, user._id.toString(), dto);
  }
  
}