export default function Loading() {
  return (
    <div role="status" aria-label="Searching hotels" className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-52 animate-pulse rounded-2xl bg-muted" />
      ))}
      <span className="sr-only">Searching hotels…</span>
    </div>
  );
}
