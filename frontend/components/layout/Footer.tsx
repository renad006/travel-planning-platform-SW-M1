import Link from "next/link";

const EXPLORE = [
  { href: "/flights", label: "Flights" },
  { href: "/hotels", label: "Hotels" },
  { href: "/itineraries", label: "Itineraries" },
  { href: "/blog", label: "Blog" },
];

const ACCOUNT = [
  { href: "/login", label: "Log in" },
  { href: "/register", label: "Sign up" },
  { href: "/profile", label: "Profile" },
];

export default function Footer() {
  return (
    <footer className="mt-auto bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <p className="text-lg font-semibold">Travel Platform</p>
          <p className="mt-2 max-w-xs text-sm text-primary-foreground/70">
            Plan, book and share your trips: flights, hotels, itineraries and travel stories.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-tan">Explore</p>
          <ul className="mt-3 space-y-2 text-sm">
            {EXPLORE.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-primary-foreground/80 hover:text-brand-tan">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-tan">Account</p>
          <ul className="mt-3 space-y-2 text-sm">
            {ACCOUNT.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-primary-foreground/80 hover:text-brand-tan">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} Travel Platform. GIU Software Project I.
      </div>
    </footer>
  );
}