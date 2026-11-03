import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { PaginatedResponse } from '../interfaces/paginated-response.interface';

export function getSkip(query: PaginationQueryDto): number {
  return (query.page - 1) * query.limit;
}

export function getSort(
  query: PaginationQueryDto,
  defaultField = 'createdAt',
): Record<string, 1 | -1> {
  return { [query.sortBy ?? defaultField]: query.sortOrder === 'asc' ? 1 : -1 };
}

export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  query: PaginationQueryDto,
): PaginatedResponse<T> {
  return { items, total, page: query.page, limit: query.limit };
}