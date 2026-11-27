"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { homeForRole } from "@/lib/types";

const PRIMARY_LINKS = [
  { href: "/flights", label: "Flights" },
  { href: "/hotels", label: "Hotels" },
  { href: "/itineraries", label: "Itineraries" },
  { href: "/blog", label: "Blog" },
];

const USER_MENU = [
  { href: "/profile", label: "Profile" },
  { href: "/bookings/flights", label: "My flight bookings" },
  { href: "/bookings/hotels", label: "My hotel reservations" },
  { href: "/my/itineraries", label: "My itineraries" },
  { href: "/my/posts", label: "My posts" },
  { href: "/notifications", label: "Notifications" },
  { href: "/change-password", label: "Change password" },
];

const STAFF_MENU = [
  { href: "/profile", label: "Profile" },
  { href: "/notifications", label: "Notifications" },
  { href: "/change-password", label: "Change password" },
];

function PlaneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2 11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

export default function Navbar() {
  const { user, role, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const isStaff = !!role && role !== "user";
  const menu = isStaff ? STAFF_MENU : USER_MENU;
  const links =
    isStaff && role
      ? [{ href: homeForRole(role), label: "Dashboard" }, ...PRIMARY_LINKS]
      : PRIMARY_LINKS;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const desktopLink = (href: string) =>
    `border-b-2 py-1 text-sm font-medium transition-colors hover:text-brand-tan ${
      isActive(href)
        ? "border-brand-tan text-brand-tan"
        : "border-transparent text-primary-foreground/90"
    }`;

  const mobileLink = (href: string) =>
    `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/10 ${
      isActive(href) ? "text-brand-tan" : "text-primary-foreground"
    }`;

  function closeAll() {
    setMenuOpen(false);
    setMobileOpen(false);
  }

  async function handleLogout() {
    closeAll();
    try {
      await logout();
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-brand-navy text-primary-foreground shadow-md">
      {/* Brand stripe */}
      <div className="flex h-1.5" aria-hidden="true">
        <span className="flex-1 bg-brand-steel" />
        <span className="flex-1 bg-brand-tan" />
        <span className="flex-1 bg-brand-coffee" />
        <span className="flex-1 bg-brand-maroon" />
      </div>

      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" onClick={closeAll} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-tan text-brand-navy">
            <PlaneIcon />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Travel<span className="text-brand-tan">Platform</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={desktopLink(l.href)}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          {loading ? (
            <div className="h-9 w-24" aria-hidden="true" />
          ) : user ? (
            <>
              <Link
                href="/notifications"
                aria-label="Notifications"
                className="rounded-full p-2 text-brand-tan transition-colors hover:bg-white/10"
              >
                <BellIcon />
              </Link>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex items-center gap-2 rounded-full bg-white/10 py-1.5 pl-1.5 pr-4 text-sm font-medium transition-colors hover:bg-white/20"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tan font-bold text-brand-navy">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-32 truncate">{user.name}</span>
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-3 w-60 overflow-hidden rounded-xl border-2 border-brand-tan bg-background py-1 text-foreground shadow-xl"
                  >
                    {menu.map((m) => (
                      <Link
                        key={m.href}
                        href={m.href}
                        role="menuitem"
                        onClick={closeAll}
                        className="block px-4 py-2.5 text-sm font-medium transition-colors hover:bg-brand-tan/30"
                      >
                        {m.label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="block w-full border-t border-brand-tan/60 px-4 py-2.5 text-left text-sm font-semibold text-brand-maroon transition-colors hover:bg-brand-maroon hover:text-primary-foreground"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-brand-tan/70 px-5 py-2 text-sm font-medium text-brand-tan transition-colors hover:bg-brand-tan hover:text-brand-navy"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-brand-maroon px-5 py-2 text-sm font-semibold text-primary-foreground ring-1 ring-brand-tan/60 transition hover:-translate-y-0.5 hover:brightness-125"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          className="rounded-lg p-2 text-brand-tan hover:bg-white/10 md:hidden"
        >
          <MenuIcon open={mobileOpen} />
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-white/10 md:hidden">
          <ul className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={closeAll} className={mobileLink(l.href)}>
                  {l.label}
                </Link>
              </li>
            ))}
            {!loading && user && (
              <>
                <li className="my-2 border-t border-white/10" />
                {menu.map((m) => (
                  <li key={m.href}>
                    <Link href={m.href} onClick={closeAll} className={mobileLink(m.href)}>
                      {m.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-2 block w-full rounded-lg bg-brand-maroon px-3 py-2.5 text-left text-sm font-semibold text-primary-foreground ring-1 ring-brand-tan/60"
                  >
                    Log out
                  </button>
                </li>
              </>
            )}
            {!loading && !user && (
              <>
                <li className="my-2 border-t border-white/10" />
                <li>
                  <Link
                    href="/login"
                    onClick={closeAll}
                    className="block rounded-lg border border-brand-tan/70 px-3 py-2.5 text-center text-sm font-medium text-brand-tan"
                  >
                    Log in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/register"
                    onClick={closeAll}
                    className="mt-2 block rounded-lg bg-brand-maroon px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground ring-1 ring-brand-tan/60"
                  >
                    Sign up
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </header>
  );
}