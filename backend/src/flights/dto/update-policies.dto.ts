import { IsString, IsNotEmpty, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BaggagePolicyDto {
  @ApiProperty({ example: '7kg' })
  @IsString()
  @IsNotEmpty()
  cabin: string;

  @ApiProperty({ example: '23kg' })
  @IsString()
  @IsNotEmpty()
  checked: string;
}

export class CancellationRuleDto {
  @ApiProperty({ example: 48 })
  @IsNumber()
  hoursBeforeDeparture: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  refundPercentage: number;
}

export class CancellationPolicyDto {
  @ApiProperty({ type: [CancellationRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CancellationRuleDto)
  rules: CancellationRuleDto[];
}