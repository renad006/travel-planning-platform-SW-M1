import { Hotel } from "lucide-react";

/** Hotel logo next to a page title and its description line; children go under the description. */
export function PageTitle({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-start gap-5">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-maroon text-card">
        <Hotel aria-hidden strokeWidth={1.5} className="size-7" />
      </span>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
        <p className="mt-2 text-brand-navy/70">{subtitle}</p>
        {children}
      </div>
    </header>
  );
}
