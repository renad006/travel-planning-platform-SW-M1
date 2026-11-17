import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument, PostStatus } from './schemas/post.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto'; // <--- ADDED
import { GetPostsDto } from './dto/get-posts.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Like, LikeDocument } from './schemas/like.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()

export class BlogService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>, // <--- ADD THIS
    @InjectModel(Like.name) private likeModel: Model<LikeDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>, // <--- ADD THIS
  ) {}

    async findAllPublished(dto: GetPostsDto) {
    const { page = 1, limit = 10, tag, q } = dto;
    const skip = (page - 1) * limit;

    const query: any = { status: PostStatus.PUBLISHED, isHidden: false };

    if (tag) {
      query.tags = tag.toLowerCase().trim();
    }

    if (q) {
      const regex = new RegExp(q, 'i');
      query.$or = [{ title: regex }, { tags: regex }, { body: regex }];
    }

    const [posts, total] = await Promise.all([
      this.postModel
        .find(query)
        .sort({ interactionScore: -1, publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(query).exec(),
    ]);

    return {
      data: posts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createPost(authorId: string, dto: CreatePostDto): Promise<PostDocument> {
    // 1. Normalize tags (lowercase, trim, remove duplicates) - BLG-08
    let normalizedTags: string[] = [];
    if (dto.tags && dto.tags.length > 0) {
      normalizedTags = [
        ...new Set(dto.tags.map((t) => t.trim().toLowerCase())),
      ];
    }

    // 2. Determine publishedAt date
    const publishedAt = dto.status === PostStatus.PUBLISHED ? new Date() : undefined;

    // 3. Create and save
    const newPost = new this.postModel({
      authorId: new Types.ObjectId(authorId),
      title: dto.title,
      body: dto.body,
      tags: normalizedTags,
      status: dto.status || PostStatus.DRAFT,
      publishedAt,
    });

    return newPost.save();
  }

    async findMyPosts(authorId: string, dto: PaginationQueryDto) {
    const { page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    const query = { authorId: new Types.ObjectId(authorId) };

    const [posts, total] = await Promise.all([
      this.postModel
        .find(query)
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(query).exec(),
    ]);

    return {
      data: posts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }


    async updatePost(postId: string, authorId: string, dto: UpdatePostDto) {
    const post = await this.postModel.findById(postId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Ownership check (BLG-04)
    if (post.authorId.toString() !== authorId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    // Update fields if they exist in the DTO
    if (dto.title) post.title = dto.title;
    if (dto.body) post.body = dto.body;
    
    if (dto.tags) {
      post.tags = [...new Set(dto.tags.map((t) => t.trim().toLowerCase()))];
    }
    
    if (dto.status && dto.status !== post.status) {
      post.status = dto.status;
      if (dto.status === PostStatus.PUBLISHED && !post.publishedAt) {
        post.publishedAt = new Date();
      }
    }

    return post.save();
  }

  async deletePost(postId: string, authorId: string) {
    const post = await this.postModel.findById(postId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId.toString() !== authorId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await post.deleteOne();
    
    // Note: Later we will also delete comments, likes, and images here. 
    // For now, we just delete the post itself.
    
    return { message: 'Post deleted successfully' };
  }

    async addComment(postId: string, authorId: string, dto: CreateCommentDto) {
    const post = await this.postModel.findById(postId);
    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException('Post not found or not published');
    }

    const comment = await this.commentModel.create({
      postId: new Types.ObjectId(postId),
      authorId: new Types.ObjectId(authorId),
      text: dto.text,
    });

    // Increment counters on the post
    await this.postModel.updateOne(
      { _id: postId },
      { $inc: { commentCount: 1, interactionScore: 1 } },
    );

    return comment;
  }

  async updateComment(commentId: string, authorId: string, dto: CreateCommentDto) {
    const comment = await this.commentModel.findById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId.toString() !== authorId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    comment.text = dto.text;
    return comment.save();
  }

  async deleteComment(commentId: string, authorId: string) {
    const comment = await this.commentModel.findById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId.toString() !== authorId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await comment.deleteOne();

    // Decrement counters
    await this.postModel.updateOne(
      { _id: comment.postId },
      { $inc: { commentCount: -1, interactionScore: -1 } },
    );

    return { message: 'Comment deleted' };
  }

    async likePost(postId: string, userId: string) {
    const post = await this.postModel.findById(postId);
    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException('Post not found or not published');
    }

    try {
      // The unique index in the schema prevents duplicates
      await this.likeModel.create({
        postId: new Types.ObjectId(postId),
        userId: new Types.ObjectId(userId),
      });

      await this.postModel.updateOne(
        { _id: postId },
        { $inc: { likeCount: 1, interactionScore: 1 } },
      );

      return { message: 'Post liked' };
    } catch (error) {
           if ((error as any).code === 11000) { // MongoDB Duplicate Key Error 
        throw new ConflictException('You have already liked this post');
      }
      throw error;
    }
  }

  async unlikePost(postId: string, userId: string) {
    const result = await this.likeModel.deleteOne({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      throw new BadRequestException('You have not liked this post');
    }

    await this.postModel.updateOne(
      { _id: postId },
      { $inc: { likeCount: -1, interactionScore: -1 } },
    );

    return { message: 'Post unliked' };
  }

    async getAuthorProfile(authorId: string, dto: PaginationQueryDto) {
    const user = await this.userModel.findById(authorId).select('name createdAt');
    if (!user) {
      throw new NotFoundException('Author not found');
    }

    const { page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    // Only show published, non-hidden posts
    const query = {
      authorId: new Types.ObjectId(authorId),
      status: PostStatus.PUBLISHED,
      isHidden: false,
    };

    const [posts, total] = await Promise.all([
      this.postModel
        .find(query)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(query).exec(),
    ]);

    return {
      author: {
        name: user.name,
        joinDate: (user as any).createdAt, // Mongoose timestamps add this automatically
      },
      posts: {
        data: posts,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
      itineraries: [], // TODO BLG-12: Fetch public itineraries from Member 6's model when ready
    };
  }
}