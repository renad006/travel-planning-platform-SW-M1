import { PartialType } from '@nestjs/swagger';
import { CreatePostDto } from './create-post.dto';

export class UpdatePostDto extends PartialType(CreatePostDto) {}

//(This magically makes every field from CreatePostDto optional, so they can update just the title, or just the body).