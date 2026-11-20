import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { Post, PostSchema } from './schemas/post.schema';
import { Comment, CommentSchema } from './schemas/comment.schema';
import { Like, LikeSchema } from './schemas/like.schema';
import { CommentsController } from './comments.controller';
import { TagsController } from './tags.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AuthorsController } from './authors.controller';
import { UploadsModule } from '../uploads/uploads.module';
import { Itinerary, ItinerarySchema } from '../itineraries/schemas/itinerary.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Like.name, schema: LikeSchema },
      { name: User.name, schema: UserSchema },
       { name: Itinerary.name, schema: ItinerarySchema },
    
    ]), UploadsModule,
  ],
    controllers: [BlogController, CommentsController, TagsController,AuthorsController ],
  providers: [BlogService],
})
export class BlogModule {}