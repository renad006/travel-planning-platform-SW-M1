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

function Column({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-widest text-brand-tan">
        {title}
      </p>
      <ul className="mt-4 space-y-2.5 text-sm">
        {items.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-primary-foreground/90 transition-colors hover:text-brand-tan"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="mt-auto bg-brand-coffee text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <p className="text-xl font-bold">
            Travel<span className="text-brand-tan">Platform</span>
          </p>
          <p className="mt-3 max-w-xs text-sm text-primary-foreground/85">
            Plan, book and share your trips: flights, hotels, itineraries and
            travel stories.
          </p>
        </div>
        <Column title="Explore" items={EXPLORE} />
        <Column title="Account" items={ACCOUNT} />
      </div>
      <div className="bg-brand-maroon py-3 text-center text-xs font-medium">
        © {new Date().getFullYear()} Travel Platform. GIU Software Project I.
      </div>
    </footer>
  );
}