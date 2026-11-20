import { SetMetadata } from '@nestjs/common';
import { ProviderType } from '../enums/provider-type.enum';

export const PROVIDER_SCOPE_KEY = 'providerScope';

export interface ProviderScopeOptions {
  type: ProviderType;
  param: string;
}

// Usage: @ProviderScope(ProviderType.AIRLINE) on a route with an :id param
// (the id is the airline/hotel id). Pass a second argument if the param
// has another name, e.g. @ProviderScope(ProviderType.HOTEL, 'hotelId').
export const ProviderScope = (type: ProviderType, param = 'id') =>
  SetMetadata(PROVIDER_SCOPE_KEY, { type, param } as ProviderScopeOptions);