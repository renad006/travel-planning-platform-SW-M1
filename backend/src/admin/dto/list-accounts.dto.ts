import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { Role } from '../../common/enums/role.enum';

export class ListAccountsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'ACC-14: search by name or email (case-insensitive)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: Role, description: 'ACC-14: filter by role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: AccountStatus, description: 'ACC-14: filter by status' })
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}