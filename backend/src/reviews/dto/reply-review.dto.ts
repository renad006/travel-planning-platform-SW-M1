import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReplyReviewDto {
  @ApiProperty({ maxLength: 1000, example: 'Thank you for staying with us!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text: string;
}