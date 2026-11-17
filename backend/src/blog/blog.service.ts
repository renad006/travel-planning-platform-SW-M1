import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument, PostStatus } from './schemas/post.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { GetPostsDto } from './dto/get-posts.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Like, LikeDocument } from './schemas/like.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UploadsService } from '../uploads/uploads.service';

@Injectable()
export class BlogService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(Like.name) private likeModel: Model<LikeDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly uploadsService: UploadsService,
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
      
      // Fix: Search by author name too
      const matchingUsers = await this.userModel.find({ name: regex }).select('_id');
      const userIds = matchingUsers.map((u) => u._id);

      query.$or = [
        { title: regex },
        { tags: regex },
        { body: regex },
        { authorId: { $in: userIds } },
      ];
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
    let normalizedTags: string[] = [];
    if (dto.tags && dto.tags.length > 0) {
      normalizedTags = [
        ...new Set(dto.tags.map((t) => t.trim().toLowerCase())),
      ];
    }

    const publishedAt = dto.status === PostStatus.PUBLISHED ? new Date() : undefined;

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
        .sort({ createdAt: -1 })
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

    if (post.authorId.toString() !== authorId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

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

  // Fix: Proper cascade delete for images, likes, and comments
  async deletePost(postId: string, authorId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId.toString() !== authorId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    // 1. Delete associated images from disk
    for (const img of post.images) {
      await this.uploadsService.deleteFile('posts', img.filename);
    }

    // 2. Delete likes and comments
    await this.likeModel.deleteMany({ postId: post._id });
    await this.commentModel.deleteMany({ postId: post._id });

    // 3. Delete the post
    await post.deleteOne();
    
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
      if ((error as any).code === 11000) {
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
        joinDate: (user as any).createdAt,
      },
      posts: {
        data: posts,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
      itineraries: [], // TODO BLG-12: Fetch public itineraries from Member 6's model when ready
    };
  }

  async addImageToPost(postId: string, authorId: string, file: Express.Multer.File) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId.toString() !== authorId) {
      throw new ForbiddenException('You can only add images to your own posts');
    }

    if (post.images.length >= 5) {
      throw new BadRequestException('Maximum 5 images allowed per post');
    }

    const savedImage = await this.uploadsService.saveFile(file, 'posts');
    post.images.push(savedImage);
    await post.save();

    return post.images;
  }

  async deleteImageFromPost(postId: string, imageId: string, authorId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId.toString() !== authorId) {
      throw new ForbiddenException('You can only delete images from your own posts');
    }

    const imageIndex = post.images.findIndex((img) => img.id === imageId);
    if (imageIndex === -1) throw new NotFoundException('Image not found');

    const image = post.images[imageIndex];
    
    post.images.splice(imageIndex, 1);
    await post.save();

    await this.uploadsService.deleteFile('posts', image.filename);

    return { message: 'Image deleted' };
  }

  // Fix: Added the missing GET single post method
  async getPostById(postId: string, userId?: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');

    const authorIdStr = post.authorId.toString();

    if (post.status === PostStatus.DRAFT && authorIdStr !== userId) {
      throw new NotFoundException('Post not found');
    }
    if (post.isHidden && authorIdStr !== userId) {
       throw new NotFoundException('Post not found');
    }

    const comments = await this.commentModel
      .find({ postId: post._id, isHidden: false })
      .sort({ createdAt: 1 })
      .exec();

    let likedByMe = false;
    if (userId) {
      const like = await this.likeModel.findOne({ 
        postId: post._id, 
        userId: new Types.ObjectId(userId) 
      });
      if (like) likedByMe = true;
    }

    return {
      ...post.toJSON(),
      comments,
      likedByMe,
    };
  }
}