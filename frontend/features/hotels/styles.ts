/** Shared look of the hotel pages in three palette colors: navy text, white cards, maroon actions, tan accents. */
const ease = "transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

export const surface = "rounded-2xl bg-card text-card-foreground shadow-[0_18px_40px_-28px] shadow-brand-navy/40 ring-1 ring-brand-navy/5";
export const redButton = `rounded-full bg-brand-maroon text-card hover:bg-brand-maroon/90 active:scale-[0.98] ${ease}`;
export const outlineButton = `rounded-full border border-brand-navy/20 bg-card text-brand-navy hover:border-brand-navy hover:bg-brand-navy hover:text-card ${ease}`;
export const sectionHeading = "text-xl font-semibold tracking-tight";
export const chip = "rounded-full bg-brand-tan/30 px-3 py-1 text-xs font-medium";
export const emptyBox = "rounded-2xl bg-brand-tan/15 p-10 text-center text-sm text-brand-navy/70";
