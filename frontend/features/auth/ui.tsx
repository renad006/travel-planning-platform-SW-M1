import type { InputHTMLAttributes, ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-[80vh] md:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-brand-navy px-12 text-primary-foreground md:flex md:flex-col md:justify-center">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand-steel/40" aria-hidden="true" />
        <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-brand-maroon/80" aria-hidden="true" />
        <div className="absolute bottom-28 left-10 h-24 w-24 rounded-full bg-brand-coffee" aria-hidden="true" />

        <div className="relative z-10 max-w-md">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-tan">
            Travel Platform
          </p>
          <h2 className="mt-3 text-4xl font-bold leading-tight">
            Your next trip starts here.
          </h2>
          <p className="mt-4 text-base text-primary-foreground/85">
            Search flights and hotels, build day-by-day itineraries and share
            your travel stories.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
            <span className="rounded-full bg-brand-tan px-4 py-1.5 text-brand-navy">Flights</span>
            <span className="rounded-full bg-brand-steel px-4 py-1.5">Hotels</span>
            <span className="rounded-full bg-brand-coffee px-4 py-1.5">Itineraries</span>
            <span className="rounded-full bg-brand-maroon px-4 py-1.5 ring-1 ring-brand-tan/60">Stories</span>
          </div>
          <svg viewBox="0 0 400 220" className="mt-10 w-full max-w-sm" aria-hidden="true">
            <path
              d="M30 180 C 120 20, 280 230, 370 40"
              fill="none"
              strokeWidth="3"
              strokeDasharray="8 10"
              strokeLinecap="round"
              className="stroke-brand-tan"
            />
            <circle cx="30" cy="180" r="12" className="fill-brand-tan" />
            <circle cx="370" cy="40" r="15" strokeWidth="3" className="fill-brand-maroon stroke-brand-tan" />
          </svg>
        </div>
      </aside>

      {/* Form */}
      <section className="flex items-center justify-center bg-background px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-5 h-1.5 w-16 rounded-full bg-brand-maroon" />
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          )}
          <div className="mt-8">{children}</div>
          {footer && (
            <div className="mt-8 text-center text-sm text-muted-foreground [&_a]:font-semibold [&_a]:text-brand-maroon [&_a]:underline">
              {footer}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function TextField({
  label,
  id,
  error,
  ...props
}: { label: string; id: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-foreground">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-full rounded-xl border border-brand-steel/50 bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-brand-steel focus:ring-2 focus:ring-brand-steel/40 aria-[invalid=true]:border-brand-maroon"
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-brand-maroon">
          {error}
        </p>
      )}
    </div>
  );
}

export function ErrorList({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div
      role="alert"
      className="space-y-1 rounded-xl border border-brand-maroon/40 bg-brand-maroon/10 p-3 text-sm font-medium text-brand-maroon"
    >
      {messages.map((m) => (
        <p key={m}>{m}</p>
      ))}
    </div>
  );
}

export function SubmitButton({
  children,
  pending,
}: {
  children: ReactNode;
  pending: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-brand-maroon px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:-translate-y-0.5 hover:shadow-lg hover:brightness-125 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Please wait..." : children}
    </button>
  );
}