import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument, PostStatus } from './schemas/post.schema';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class BlogService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
  ) {}

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
}