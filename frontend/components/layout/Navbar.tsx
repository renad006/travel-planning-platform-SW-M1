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
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
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

  const linkClass = (href: string) =>
    `text-sm font-medium transition-colors hover:text-brand-tan ${
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-primary text-primary-foreground">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" onClick={closeAll} className="text-lg font-semibold tracking-tight">
          Travel Platform
        </Link>

        <ul className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={linkClass(l.href)}>
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
                className="rounded-full p-2 transition-colors hover:bg-white/10"
              >
                <BellIcon />
              </Link>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex items-center gap-2 rounded-full bg-white/10 py-1.5 pl-1.5 pr-3 text-sm font-medium transition-colors hover:bg-white/20"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-tan text-primary">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-32 truncate">{user.name}</span>
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-background py-1 text-foreground shadow-lg"
                  >
                    {menu.map((m) => (
                      <Link
                        key={m.href}
                        href={m.href}
                        role="menuitem"
                        onClick={closeAll}
                        className="block px-4 py-2 text-sm hover:bg-muted"
                      >
                        {m.label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="block w-full border-t border-border px-4 py-2 text-left text-sm text-destructive hover:bg-muted"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium transition-colors hover:text-brand-tan">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-brand-tan px-4 py-2 text-sm font-semibold text-primary transition-opacity hover:opacity-90"
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
          className="rounded-md p-2 hover:bg-white/10 md:hidden"
        >
          <MenuIcon open={mobileOpen} />
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-white/10 md:hidden">
          <ul className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={closeAll} className={`block py-2 ${linkClass(l.href)}`}>
                  {l.label}
                </Link>
              </li>
            ))}
            {!loading && user && (
              <>
                <li className="my-2 border-t border-white/10" />
                {menu.map((m) => (
                  <li key={m.href}>
                    <Link href={m.href} onClick={closeAll} className={`block py-2 ${linkClass(m.href)}`}>
                      {m.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full py-2 text-left text-sm font-medium hover:text-brand-tan"
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
                  <Link href="/login" onClick={closeAll} className="block py-2 text-sm font-medium hover:text-brand-tan">
                    Log in
                  </Link>
                </li>
                <li>
                  <Link href="/register" onClick={closeAll} className="block py-2 text-sm font-semibold text-brand-tan">
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