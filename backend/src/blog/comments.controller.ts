import { Controller, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Blog - Comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly blogService: BlogService) {}

  @Patch(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Edit own comment (BLG-07)' })
  async updateComment(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateCommentDto,
  ) {
    return this.blogService.updateComment(id, user._id.toString(), dto);
  }

  @Delete(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Delete own comment (BLG-07)' })
  async deleteComment(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.blogService.deleteComment(id, user._id.toString());
  }
}