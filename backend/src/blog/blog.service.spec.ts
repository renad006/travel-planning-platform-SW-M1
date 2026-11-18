import { Test, TestingModule } from '@nestjs/testing';
import { BlogService } from './blog.service';
import { getModelToken } from '@nestjs/mongoose';
import { Post } from './schemas/post.schema';
import { Comment } from './schemas/comment.schema';
import { Like } from './schemas/like.schema';
import { User } from '../users/schemas/user.schema';
import { UploadsService } from '../uploads/uploads.service';
import { Itinerary } from '../itineraries/schemas/itinerary.schema';

describe('BlogService', () => {
  let service: BlogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogService,
        { provide: getModelToken(Post.name), useValue: {} },
        { provide: getModelToken(Comment.name), useValue: {} },
        { provide: getModelToken(Like.name), useValue: {} },
        { provide: getModelToken(User.name), useValue: {} },
        { provide: getModelToken(Itinerary.name), useValue: {} },
        { provide: UploadsService, useValue: {} },
      ],
    }).compile();

    service = module.get<BlogService>(BlogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});