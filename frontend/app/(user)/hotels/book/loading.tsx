export default function Loading() {
  return (
    <div role="status" aria-label="Loading your booking" className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      <span className="sr-only">Loading your booking…</span>
    </div>
  );
}
