"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { formatPrice } from "../format";
import { outlineButton, redButton, surface } from "../styles";

interface RefundPreview {
  percent: number;
  amount: number;
  daysRemaining: number;
}

/** Shows the refund first, then cancels the whole reservation after a confirmation (HTL-21, GEN-03). */
export function CancelReservation({ id }: { id: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setErrors([]);
    try {
      await action();
    } catch (error) {
      setPreview(null);
      setErrors(error instanceof ApiError ? error.messages : ["We could not reach the server. Try again."]);
    } finally {
      setBusy(false);
    }
  }

  const ask = () =>
    run(async () => setPreview(await api.get<RefundPreview>(`/api/hotel-bookings/${id}/refund-preview`)));

  const confirm = () =>
    run(async () => {
      await api.post(`/api/hotel-bookings/${id}/cancel`);
      setPreview(null);
      router.refresh();
    });

  return (
    <section aria-label="Cancel reservation" className={`flex flex-col gap-3 p-5 ${surface}`}>
      {preview ? (
        // Placeholder until the shared ConfirmDialog (Member 1) is merged.
        <>
          <h2 className="font-semibold">Cancel this reservation?</h2>
          <p className="rounded-lg bg-brand-tan/25 p-3 text-sm">
            You get back <strong>{formatPrice(preview.amount)}</strong> ({preview.percent}% of the total),{" "}
            {preview.daysRemaining} {preview.daysRemaining === 1 ? "day" : "days"} before check-in.
          </p>
          <p className="text-sm text-brand-navy/70">All rooms are released. This cannot be undone.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" className={`h-10 px-5 ${redButton}`} onClick={confirm} disabled={busy}>
              {busy ? "Cancelling…" : "Yes, cancel it"}
            </Button>
            <Button size="lg" className={`h-10 px-5 ${outlineButton}`} onClick={() => setPreview(null)} disabled={busy}>
              Keep reservation
            </Button>
          </div>
        </>
      ) : (
        <Button size="lg" className={`h-10 self-start px-5 ${outlineButton}`} onClick={ask} disabled={busy}>
          {busy ? "Checking refund…" : "Cancel reservation"}
        </Button>
      )}
      {errors.length > 0 && (
        <ul role="alert" className="text-sm text-destructive">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
