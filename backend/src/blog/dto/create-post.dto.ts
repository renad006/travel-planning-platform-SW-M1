import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength, ArrayMaxSize, MinLength } from 'class-validator';
import { PostStatus } from '../schemas/post.schema';

export class CreatePostDto {
  @ApiProperty({ example: 'My Trip to Paris' })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ example: 'It was a beautiful day...' })
  @IsString()
  @MinLength(1)
  body: string;

  @ApiPropertyOptional({ example: ['travel', 'paris'], maxItems: 5 })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @ArrayMaxSize(5)
  tags?: string[];

  @ApiPropertyOptional({ enum: PostStatus, default: PostStatus.DRAFT })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}