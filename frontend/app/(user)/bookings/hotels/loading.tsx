export default function Loading() {
  return (
    <div role="status" aria-label="Loading your reservations" className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-12 sm:px-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
      ))}
      <span className="sr-only">Loading your reservations…</span>
    </div>
  );
}
