import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const VISIBILITIES = ['public', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** ITN-20 */
export class SetVisibilityDto {
  @ApiProperty({
    enum: VISIBILITIES,
    example: 'public',
    description: 'public: appears in shared search and others can view it read-only. private: only you.',
  })
  @IsIn(VISIBILITIES, { message: 'visibility must be public or private' })
  visibility: Visibility;
}
