import { Hotel } from "lucide-react";
import Image from "next/image";
import hero from "../hero.webp";

/** Photo header of the search page; the search bar overlaps its lower edge. */
export function SearchHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="relative flex min-h-80 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl bg-brand-navy px-6 pt-8 pb-16 text-center text-card lg:min-h-96">
      <Image src={hero} alt="" fill preload placeholder="blur" sizes="(min-width: 72rem) 69rem, 100vw" className="object-cover" />
      {/* flat navy tint so the text stays readable on the photo */}
      <div className="absolute inset-0 bg-brand-navy/55" />
      <span className="relative flex size-12 items-center justify-center rounded-2xl bg-brand-tan text-brand-navy">
        <Hotel aria-hidden strokeWidth={1.5} className="size-6" />
      </span>
      <h1 className="relative text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
      <p className="relative max-w-xl text-balance">{subtitle}</p>
    </header>
  );
}
