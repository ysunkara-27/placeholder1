import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// GET /auth/callback?code=...
//
// Supabase redirects here after magic link clicks and OAuth sign-ins.
// We exchange the one-time code for a session, then route the user:
//   - No profile yet (new sign-up) → /onboarding
//   - Profile exists (returning user)  → /dashboard

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=missing_code`);
  }

  // We need a mutable response reference so the cookie setter can replace it.
  let response = NextResponse.redirect(`${origin}/dashboard`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.redirect(`${origin}/dashboard`);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL(`${origin}/auth`);
    url.searchParams.set("error", "link_expired");
    return NextResponse.redirect(url.toString());
  }

  // Route new users (no profile) to onboarding, returning users to dashboard.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed) {
      // Preserve session cookies already set on `response`, just change the URL.
      const destination = new URL(`${origin}/onboarding`);
      const redirect = NextResponse.redirect(destination);
      response.cookies.getAll().forEach(({ name, value }) => {
        redirect.cookies.set(name, value);
      });
      return redirect;
    }
  }

  return response;
}
