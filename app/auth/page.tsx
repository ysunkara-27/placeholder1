"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Phase = "form" | "sent";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Surface error from callback redirect (e.g. ?error=link_expired)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "link_expired") {
      setError("That sign-in link has expired. Request a new one below.");
    } else if (err === "missing_code") {
      setError("Something went wrong with the sign-in link. Try again.");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : "/auth/callback";

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          // Don't create a new user — only sign in existing accounts.
          // New users go through /onboarding first.
          shouldCreateUser: false,
          emailRedirectTo: redirectTo,
        },
      });

      if (otpError) {
        // Supabase returns a generic error for rate limiting or server issues.
        // For security it does NOT reveal whether the email exists.
        throw otpError;
      }

      setPhase("sent");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between border-b border-gray-100">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-gray-900 hover:text-gray-700 transition-colors"
        >
          Twin
        </Link>
        <Link
          href="/onboarding"
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          New here? Set up your Twin →
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-8">
          {phase === "form" ? (
            <>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  Sign in to Twin
                </h1>
                <p className="text-sm text-gray-500">
                  We&apos;ll send a sign-in link to your inbox — no password needed.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send sign-in link
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-xs text-gray-400">
                Don&apos;t have a Twin yet?{" "}
                <Link
                  href="/onboarding"
                  className="text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Build yours in 4 minutes
                </Link>
              </p>
            </>
          ) : (
            <>
              {/* Sent state */}
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Mail className="w-7 h-7" />
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    Check your inbox
                  </h1>
                  <p className="text-sm text-gray-500 max-w-xs">
                    We sent a sign-in link to{" "}
                    <span className="font-medium text-gray-800">{email}</span>.
                    Click it to open your dashboard.
                  </p>
                </div>

                <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-left space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Didn&apos;t get it?
                  </p>
                  <p className="text-sm text-gray-600">
                    Check your spam folder or{" "}
                    <button
                      onClick={() => {
                        setPhase("form");
                        setError(null);
                      }}
                      className="text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      try a different email
                    </button>
                    .
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
