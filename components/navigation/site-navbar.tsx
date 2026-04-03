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
  { href: "/jobs", label: "Browse jobs" },
  { href: "/apply-lab", label: "Apply lab" },
  { href: "/onboarding", label: "Edit profile" },
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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      setIsSignedIn(Boolean(session?.user?.id));
      setReady(true);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setIsSignedIn(Boolean(session?.user?.id));
      setReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const visibleLinks = isSignedIn ? AUTHED_LINKS : [];

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <Link
          href={isSignedIn ? "/dashboard" : "/"}
          className="text-lg font-semibold tracking-tight text-gray-900"
        >
          Twin
        </Link>

        <div className="flex items-center gap-3">
          {visibleLinks.map((link) => {
            const active = isActivePath(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}

          {ready && isSignedIn ? (
            <SignOutButton />
          ) : (
            <Link
              href="/auth"
              aria-current={pathname === "/auth" ? "page" : undefined}
              className={[
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                pathname === "/auth"
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
              ].join(" ")}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
