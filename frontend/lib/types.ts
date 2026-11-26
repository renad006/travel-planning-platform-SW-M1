export type Role = "user" | "admin" | "airline_moderator" | "hotel_moderator";
export type AccountStatus = "active" | "suspended" | "deactivated";
export type ProviderType = "airline" | "hotel";

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  phone?: string;
  preferredCurrency: string;
  mustChangePassword: boolean;
  termsAcceptedAt?: string;
  assignedProviderType?: ProviderType;
  assignedProviderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export const ROLE_HOME: Record<Role, string> = {
  user: "/",
  admin: "/dashboard/admin",
  airline_moderator: "/dashboard/airline",
  hotel_moderator: "/dashboard/hotel",
};

export function homeForRole(role: Role): string {
  return ROLE_HOME[role];
}