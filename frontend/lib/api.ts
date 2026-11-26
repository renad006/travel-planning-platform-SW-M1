export type ApiErrorBody = {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp?: string;
  path?: string;
};

export class ApiError extends Error {
  statusCode: number;
  error: string;
  messages: string[];
  constructor(statusCode: number, messages: string[], error: string) {
    super(messages[0] ?? "Request failed");
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.messages = messages;
    this.error = error;
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;
export type ApiOptions = { params?: Params; skipAuthRedirect?: boolean };

const AUTH_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh"];

function buildUrl(path: string, params?: Params): string {
  const base = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? "" : "/"}${path}`;
  if (!params) return base;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function redirectToLogin() {
  const { pathname, search } = window.location;
  if (pathname === "/login" || pathname === "/register") return;
  window.location.href = `/login?returnTo=${encodeURIComponent(pathname + search)}`;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {};
  try {
    body = await res.json();
  } catch {
    // empty or non-JSON body
  }
  const raw = body.message;
  const messages = Array.isArray(raw) ? raw : raw ? [raw] : [res.statusText || "Request failed"];
  return new ApiError(res.status, messages, body.error ?? res.statusText);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: ApiOptions = {},
  retried = false,
): Promise<T> {
  const url = buildUrl(path, options.params);
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body !== undefined && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });

  if (res.status === 401 && !retried && !AUTH_PATHS.some((p) => url.startsWith(p))) {
    if (await refreshSession()) return request<T>(method, path, body, options, true);
    if (!options.skipAuthRedirect && typeof window !== "undefined") redirectToLogin();
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, options?: ApiOptions) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: ApiOptions) => request<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown, options?: ApiOptions) => request<T>("PUT", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: ApiOptions) => request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: ApiOptions) => request<T>("DELETE", path, undefined, options),
};