import { cookies } from "next/headers";
import { ApiError } from "./api";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

type Params = Record<string, string | number | boolean | null | undefined>;

export type ServerApiOptions = {
  params?: Params;
  /** true (default): forward the user's cookies, never cached (dynamic SSR pages).
   *  false: no cookies, for public pages that use ISR. */
  auth?: boolean;
  /** Seconds for ISR when auth is false. */
  revalidate?: number | false;
};

function buildUrl(path: string, params?: Params): string {
  const base = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? "" : "/"}${path}`;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return `${BACKEND_URL}${base}${s ? `?${s}` : ""}`;
}

export async function serverGet<T>(path: string, options: ServerApiOptions = {}): Promise<T> {
  const { params, auth = true, revalidate } = options;
  const headers: Record<string, string> = {};

  if (auth) {
    const store = await cookies();
    const cookieHeader = store
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    if (cookieHeader) headers.cookie = cookieHeader;
  }

  const res = await fetch(buildUrl(path, params), {
    headers,
    ...(auth
      ? { cache: "no-store" as const }
      : revalidate !== undefined
        ? { next: { revalidate } }
        : {}),
  });

  if (!res.ok) {
    let body: { message?: string | string[]; error?: string } = {};
    try {
      body = await res.json();
    } catch {
      // empty or non-JSON body
    }
    const raw = body.message;
    const messages = Array.isArray(raw) ? raw : raw ? [raw] : [res.statusText || "Request failed"];
    throw new ApiError(res.status, messages, body.error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}