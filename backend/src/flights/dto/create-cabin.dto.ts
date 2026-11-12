import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsPositive, Min } from 'class-validator';
import { CabinClass } from '../schemas/cabin-inventory.schema';

/** FLT-04 */
export class CreateCabinDto {
  @ApiProperty({ enum: CabinClass, example: CabinClass.ECONOMY })
  @IsEnum(CabinClass)
  cabinClass: CabinClass;

  @ApiProperty({ example: 150, description: 'Whole number > 0' })
  @IsInt()
  @Min(1)
  totalSeats: number;

  @ApiProperty({ example: 250, description: 'Fare per adult/child (> 0), platform currency' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @ApiProperty({ example: 1, description: 'Free checked bags per passenger' })
  @IsInt()
  @Min(0)
  freeBags: number;

  @ApiProperty({ example: 23, description: 'Maximum weight per bag (kg)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  maxWeightKg: number;
}
