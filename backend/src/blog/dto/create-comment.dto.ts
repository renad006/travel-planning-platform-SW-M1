import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Great post!', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text: string;
}