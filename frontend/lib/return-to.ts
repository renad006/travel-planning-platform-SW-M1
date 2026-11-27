import { homeForRole } from "@/lib/types";
import type { User } from "@/lib/types";

// Only allow relative in-app paths, so ?returnTo= cannot redirect to another site
export function safeReturnTo(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  if (value.startsWith("/login") || value.startsWith("/register")) return fallback;
  return value;
}

// Where to go after a successful login
export function postLoginPath(user: User, returnTo?: string | null): string {
  if (user.mustChangePassword) return "/change-password";
  return safeReturnTo(returnTo, homeForRole(user.role));
}