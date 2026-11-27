import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { serverGet } from "@/lib/api.server";
import type { Hotel } from "./types";

/** The public hotel profile; shows "page not found" for an unknown or malformed id. */
export async function getHotel(id: string) {
  try {
    return await serverGet<Hotel>(`/api/hotels/${encodeURIComponent(id)}`, { auth: false });
  } catch (error) {
    // 400: malformed id, 404: no such hotel
    if (error instanceof ApiError && (error.statusCode === 400 || error.statusCode === 404)) notFound();
    throw error;
  }
}
