import { CitySkyline } from "./CitySkyline";

/** Navy page header with two flowing red waves and, on laptops, a city illustration. */
export function HeroBanner({ children }: { children: React.ReactNode }) {
  return (
    <header className="bg-brand-navy pb-24 text-primary-foreground">
      {/* the shape stretches to any width; the faded wave behind has its own curve */}
      <svg aria-hidden viewBox="0 0 1440 100" preserveAspectRatio="none" className="mb-4 block h-12 w-full sm:h-20">
        <path className="fill-brand-maroon/60" d="M0 0H1440V46C1200 96 960 92 720 66S260 36 0 84Z" />
        <path className="fill-brand-maroon" d="M0 0H1440V30C1180 4 980 78 680 62S220 12 0 52Z" />
      </svg>
      {/* same width and padding as the page content, so the left edges line up */}
      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
        {children}
        {/* stands on the top edge of the card that overlaps the header */}
        <CitySkyline className="absolute right-6 -bottom-10 hidden h-40 lg:block" />
      </div>
    </header>
  );
}
