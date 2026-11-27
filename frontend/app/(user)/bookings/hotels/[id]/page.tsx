import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { CancelReservation } from "@/features/hotels/components/CancelReservation";
import { PageTitle } from "@/features/hotels/components/PageTitle";
import { formatDate, formatPrice } from "@/features/hotels/format";
import { getMine, guestsLabel, roomLabel, STATUS_LABEL, type Reservation } from "@/features/hotels/reservations";
import { chip, redButton, surface } from "@/features/hotels/styles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reservation details | Travel Platform" };

// Dynamic SSR: confirmation page (HTL-17) and full details (HTL-20) of one reservation.
export default async function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await getMine<Reservation>(
    `/api/hotel-bookings/${encodeURIComponent(id)}`,
    `/bookings/hotels/${id}`,
  );
  const now = new Date();
  const holding = booking.status === "pending_payment" && new Date(booking.holdExpiresAt ?? 0) > now;
  const cancellable = booking.status === "confirmed" && new Date(booking.checkIn) > now;
  const tiers = [...(booking.policiesSnapshot?.cancellationTiers ?? [])].sort(
    (a, b) => b.daysBeforeDeparture - a.daysBeforeDeparture,
  );
  const hotel = booking.hotelId;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12 sm:px-6">
      <Link
        href="/bookings/hotels"
        className="inline-flex h-10 items-center self-start rounded-full bg-brand-tan px-4 text-sm font-semibold transition hover:bg-brand-tan/80 focus-visible:ring-3 focus-visible:ring-ring"
      >
        ← My reservations
      </Link>
      <PageTitle title={hotel?.name ?? "Hotel"} subtitle={hotel?.address ?? "Reservation details"}>
        <p className="mt-3 flex flex-wrap items-center gap-3">
          <span className={chip}>{STATUS_LABEL[booking.status]}</span>
          {booking.reference && <span className="text-sm font-semibold">Reference {booking.reference}</span>}
        </p>
      </PageTitle>

      {booking.status === "confirmed" && (
        <p role="status" className="rounded-2xl bg-brand-tan/30 p-5 font-medium">
          Your reservation is confirmed. Keep your reference {booking.reference} for check-in.
        </p>
      )}
      {holding && (
        // Placeholder until the shared Countdown (Member 1) is merged.
        <div role="status" className={`flex flex-wrap items-center justify-between gap-3 p-5 ${surface}`}>
          <p>
            Waiting for payment. Your rooms are held for about{" "}
            {Math.ceil((new Date(booking.holdExpiresAt!).getTime() - now.getTime()) / 60_000)} more minutes.
          </p>
          <Link
            href={`/checkout/hotel/${booking._id}`}
            className={cn(buttonVariants({ size: "lg" }), "h-10 px-5", redButton)}
          >
            Continue to payment
          </Link>
        </div>
      )}
      {(booking.status === "expired" || (booking.status === "pending_payment" && !holding)) && (
        <p role="status" className={`p-5 ${surface}`}>
          The 10-minute hold ended without payment, so the rooms were released.
        </p>
      )}

      <section className={`flex flex-col gap-4 p-6 ${surface}`}>
        <h2 className="text-lg font-semibold tracking-tight">Your stay</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Check-in", day: booking.checkIn, time: hotel?.checkInTime && `from ${hotel.checkInTime}` },
            { label: "Check-out", day: booking.checkOut, time: hotel?.checkOutTime && `by ${hotel.checkOutTime}` },
          ].map(({ label, day, time }) => (
            <div key={label} className="rounded-lg bg-brand-tan/25 p-3">
              <dt className="text-xs text-brand-navy/70">
                {label} {time}
              </dt>
              <dd className="font-semibold">{formatDate(day)}</dd>
            </div>
          ))}
        </dl>
        <ul className="divide-y text-sm">
          {booking.rooms.map((room, index) => (
            <li key={index} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">{roomLabel(room)}</p>
                <p className="text-brand-navy/70">{guestsLabel(room)}</p>
              </div>
              <p>{formatPrice(room.pricePerNight)} per night</p>
            </li>
          ))}
        </ul>
        <p className="flex items-baseline justify-between gap-3 border-t pt-3">
          <span className="font-semibold">Total</span>
          <span className="text-2xl font-semibold text-brand-maroon tabular-nums">
            {formatPrice(booking.totalPrice)}
          </span>
        </p>
      </section>

      {booking.status === "cancelled" ? (
        <section className={`flex flex-col gap-1 p-6 ${surface}`}>
          <h2 className="font-semibold">
            Cancelled{booking.cancelledBy === "hotel" ? " by the hotel" : ""}
          </h2>
          {/* Member 5's <RefundStatusBadge/> goes here (PAY-03). */}
          <p className="text-sm">
            Refund: {formatPrice(booking.refundAmount ?? 0)} ({booking.refundPercentage ?? 0}% of the total)
          </p>
        </section>
      ) : (
        <section className={`p-6 ${surface}`}>
          <h2 className="font-semibold">Cancellation policy</h2>
          {tiers.length === 0 ? (
            <p className="mt-2 text-sm text-brand-navy/70">No refund on cancellation.</p>
          ) : (
            <ul className="mt-2 divide-y text-sm">
              {tiers.map((tier) => (
                <li key={tier.daysBeforeDeparture} className="flex justify-between gap-3 py-2">
                  <span>{tier.daysBeforeDeparture}+ days before check-in</span>
                  <span className="font-semibold text-brand-maroon">{tier.refundPercentage}% refund</span>
                </li>
              ))}
              <li className="pt-2 text-xs text-brand-navy/70">Later cancellations are not refunded.</li>
            </ul>
          )}
        </section>
      )}

      {cancellable && <CancelReservation id={booking._id} />}
      {/* Completed stays: Member 5's "Write review" component goes here (HTL-23). */}
    </main>
  );
}
