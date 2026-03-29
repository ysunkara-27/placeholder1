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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "link_expired") {
      setError("That sign-in link has expired. Request a new one below.");
    } else if (err === "missing_code") {
      setError("Something went wrong with the sign-in link. Try again.");
    } else if (err === "session_required") {
      setError(
        "Onboarding needs a session. Sign in here, or enable Anonymous Auth in Supabase for the faster onboarding path."
      );
    }
  }, []);

  async function handleGoogle() {
    setGoogleLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) throw oauthError;
      // Browser navigates away — loading state stays until redirect.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Google sign-in failed. Try again."
      );
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (otpError) throw otpError;
      setPhase("sent");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-6 py-5 flex items-center border-b border-gray-100">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-gray-900 hover:text-gray-700 transition-colors"
        >
          Twin
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">
          {phase === "form" ? (
            <>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  Create your Twin
                </h1>
                <p className="text-sm text-gray-500">
                  Already have one?{" "}
                  <span className="text-gray-700">Sign in with the same method you used before.</span>
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Google OAuth */}
              <button
                type="button"
                onClick={() => void handleGoogle()}
                disabled={googleLoading}
                className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {googleLoading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                Continue with Google
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-gray-400">or continue with email</span>
                </div>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
            </>
          ) : (
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
                  Click it to continue.
                </p>
              </div>

              <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-left space-y-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Didn&apos;t get it?
                </p>
                <p className="text-sm text-gray-600">
                  Check your spam folder or{" "}
                  <button
                    onClick={() => { setPhase("form"); setError(null); }}
                    className="text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    try a different email
                  </button>
                  .
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
