// PAY-04: one platform currency. shortcut: matches the backend DEFAULT_CURRENCY default,
// read it from the API if an endpoint ever exposes it.
export const CURRENCY = "USD";

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY }).format(amount);
}

/** "new_york" -> "New York" (matches the seeded city names). */
export function cityName(cityId: string): string {
  return cityId
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const regions = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string): string {
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

// shortcut: next.config only forwards /api, so photos load from the backend address directly.
// Switch to the bare path once a /uploads rewrite is added there.
export function photoUrl(path: string): string {
  return `${process.env.BACKEND_URL ?? "http://localhost:3000"}${path}`;
}

/** "2026-12-01" -> a long date such as "Tuesday, 1 December 2026". Stays are calendar days, so format them in UTC. */
export const formatDate = (day: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "UTC" }).format(new Date(day));
