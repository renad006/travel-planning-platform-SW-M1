import { serverGet } from "@/lib/api.server";
import { cityName, countryName } from "./format";

type Airport = { cityId: string; countryCode: string };

export type Option = { value: string; label: string };

/** City and country dropdown options, derived from the seeded airports (FLT-02, public). */
export async function getPlaceOptions(): Promise<{ cities: Option[]; countries: Option[] }> {
  const { data } = await serverGet<{ data: Airport[] }>("/api/airports", {
    auth: false,
    revalidate: 3600,
    params: { limit: 100 },
  });
  const unique = (values: string[], label: (v: string) => string): Option[] =>
    [...new Set(values)]
      .map((value) => ({ value, label: label(value) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  return {
    cities: unique(data.map((a) => a.cityId), cityName),
    countries: unique(data.map((a) => a.countryCode), countryName),
  };
}
