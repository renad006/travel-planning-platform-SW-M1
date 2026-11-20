import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsNumber, IsPositive, Max, Min, ValidateNested,
} from 'class-validator';

/** FLT-08 */
export class BaggagePolicyDto {
  @ApiProperty({ example: 50, description: 'Price per extra bag (> 0)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  extraBagPrice: number;

  @ApiProperty({ example: 2, description: 'Max extra bags per passenger (>= 0)' })
  @IsInt()
  @Min(0)
  maxExtraBags: number;
}

/** FLT-09 */
export class CancellationRuleDto {
  @ApiProperty({ example: 7, description: 'Integer >= 0, unique per tier' })
  @IsInt()
  @Min(0)
  daysBeforeDeparture: number;

  @ApiProperty({ example: 100, description: '0-100' })
  @IsNumber()
  @Min(0)
  @Max(100)
  refundPercentage: number;
}

export class CancellationPolicyDto {
  @ApiProperty({ type: [CancellationRuleDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique((r: CancellationRuleDto) => r.daysBeforeDeparture, {
    message: 'Each tier needs a unique daysBeforeDeparture',
  })
  @ValidateNested({ each: true })
  @Type(() => CancellationRuleDto)
  rules: CancellationRuleDto[];
}