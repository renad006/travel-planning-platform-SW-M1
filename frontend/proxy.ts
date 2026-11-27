import { NextResponse, type NextRequest } from "next/server";
import { homeForRole } from "@/lib/types";
import type { Role } from "@/lib/types";

// Coarse UX gate only. The backend enforces real authorization.
const AUTH_PREFIXES = [
  "/my",
  "/bookings",
  "/checkout",
  "/profile",
  "/notifications",
  "/change-password",
  "/flights/book",
  "/hotels/book",
];

const ROLE_PREFIXES: { prefix: string; role: Role }[] = [
  { prefix: "/dashboard/admin", role: "admin" },
  { prefix: "/dashboard/airline", role: "airline_moderator" },
  { prefix: "/dashboard/hotel", role: "hotel_moderator" },
];

function matches(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix + "/");
}

// Reads the role from the access token payload (UX only, signature not checked).
function roleFromToken(token?: string): Role | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { role?: Role; exp?: number };
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const role = roleFromToken(request.cookies.get("access_token")?.value);

  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const needsAuth = isDashboard || AUTH_PREFIXES.some((p) => matches(pathname, p));
  if (!needsAuth) return NextResponse.next();

  // Guest on a protected page: send to login and come back afterwards
  if (!role) {
    const url = new URL("/login", request.url);
    url.searchParams.set("returnTo", pathname + search);
    return NextResponse.redirect(url);
  }

  // /dashboard alone goes to the role's own home
  if (pathname === "/dashboard") {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  // Wrong role for a dashboard: send to own home
  const rule = ROLE_PREFIXES.find((r) => matches(pathname, r.prefix));
  if (rule && rule.role !== role) {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};