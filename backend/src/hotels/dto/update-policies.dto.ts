import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, Max, Min, ValidateNested } from 'class-validator';

export class CancellationTierDto {
    @ApiProperty({ example: 7, description: 'Days before check-in, 0 or more' })
    @IsInt()
    @Min(0)
    daysBefore: number;

    @ApiProperty({ example: 50, description: 'Refund percentage, 0 to 100' })
    @IsInt()
    @Min(0)
    @Max(100)
    refundPercent: number;
}

// HTL-10: replaces the hotel's whole list of cancellation tiers
export class UpdatePoliciesDto {
    @ApiProperty({ type: [CancellationTierDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CancellationTierDto)
    cancellationTiers: CancellationTierDto[];
}