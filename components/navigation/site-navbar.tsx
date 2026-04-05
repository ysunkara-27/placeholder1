"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type NavLink = {
  href: string;
  label: string;
};

const AUTHED_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs",      label: "Browse" },
  { href: "/apply-lab", label: "Apply Lab" },
  { href: "/profile",   label: "Profile" },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNavbar() {
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      setIsSignedIn(Boolean(session?.user?.id));
      setReady(true);
    }

    void loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setIsSignedIn(Boolean(session?.user?.id));
      setReady(true);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const visibleLinks = isSignedIn ? AUTHED_LINKS : [];

  return (
    <header className="sticky top-0 z-40 border-b border-rim bg-canvas/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-3.5">

        {/* Wordmark */}
        <Link
          href={isSignedIn ? "/dashboard" : "/"}
          className="font-display text-xl font-semibold tracking-tight text-ink"
          style={{ fontVariationSettings: '"opsz" 36, "SOFT" 0, "WONK" 0' }}
        >
          Twin
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5">
          {visibleLinks.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-accent text-white"
                    : "text-dim hover:bg-surface hover:text-ink",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}

          {ready && isSignedIn ? (
            <div className="ml-1">
              <SignOutButton />
            </div>
          ) : (
            <Link
              href="/auth"
              aria-current={pathname === "/auth" ? "page" : undefined}
              className={[
                "ml-1 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-150",
                pathname === "/auth"
                  ? "bg-accent text-white"
                  : "text-dim hover:bg-surface hover:text-ink",
              ].join(" ")}
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
