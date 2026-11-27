import { notFound, redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { serverGet } from "@/lib/api.server";

export type ReservationStatus = "pending_payment" | "confirmed" | "cancelled" | "expired" | "completed";

/** A hotel reservation as GET /api/hotel-bookings returns it (HTL-20). */
export interface Reservation {
  _id: string;
  reference?: string;
  status: ReservationStatus;
  /** null if the hotel or room was removed since the booking. The address and times come with one reservation only. */
  hotelId: { _id: string; name: string; address?: string; checkInTime?: string; checkOutTime?: string } | null;
  rooms: {
    roomId: { name: string; type: string } | null;
    adults: number;
    childrenAges: number[];
    pricePerNight: number;
  }[];
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  holdExpiresAt?: string;
  policiesSnapshot?: { cancellationTiers: { daysBeforeDeparture: number; refundPercentage: number }[] };
  cancelledBy?: "user" | "hotel";
  refundPercentage?: number;
  refundAmount?: number;
}

export type ReservationGroups = Record<"upcoming" | "past" | "cancelled", Reservation[]>;

/** Reads the signed-in user's own data during server rendering. */
export async function getMine<T>(path: string, returnTo: string): Promise<T> {
  try {
    return await serverGet<T>(path);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.statusCode === 401) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      if (error.statusCode === 404) notFound();
    }
    throw error;
  }
}

/** "2 adults, 1 child (age 5)" */
export function guestsLabel({ adults, childrenAges }: Reservation["rooms"][number]) {
  const parts = [`${adults} ${adults === 1 ? "adult" : "adults"}`];
  if (childrenAges.length === 1) parts.push(`1 child (age ${childrenAges[0]})`);
  if (childrenAges.length > 1) parts.push(`${childrenAges.length} children (ages ${childrenAges.join(", ")})`);
  return parts.join(", ");
}

export const roomLabel = ({ roomId }: Reservation["rooms"][number]) =>
  roomId ? `${roomId.type} · Room ${roomId.name}` : "Room no longer listed";

// Placeholder wording until the shared StatusBadge (Member 1) is merged.
export const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  expired: "Expired",
  completed: "Completed",
};
