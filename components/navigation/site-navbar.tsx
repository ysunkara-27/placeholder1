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
    <header className="sticky top-0 z-40 border-b border-[rgba(227,205,188,0.88)] bg-[rgba(255,248,242,0.9)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-4">

        {/* Wordmark */}
        <Link
          href={isSignedIn ? "/dashboard" : "/"}
          className="font-brand text-[1.65rem] leading-none text-[rgb(144,48,28)] transition-colors hover:text-[rgb(187,74,43)]"
        >
          Twin
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {visibleLinks.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-[rgb(187,74,43)] text-white shadow-warm"
                    : "text-[rgb(125,99,82)] hover:bg-[rgba(250,233,221,0.8)] hover:text-[rgb(41,28,22)]",
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
                "ml-1 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                pathname === "/auth"
                  ? "bg-[rgb(187,74,43)] text-white shadow-warm"
                  : "text-[rgb(125,99,82)] hover:bg-[rgba(250,233,221,0.8)] hover:text-[rgb(41,28,22)]",
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
