import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require a completed profile to access
const PROTECTED_ROUTES = ["/dashboard", "/apply-lab"];

// Only these emails can access /admin and /api/admin
const ADMIN_EMAILS = ["sunkarayashaswi@gmail.com", "surajnvaddi@gmail.com"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  // Admin routes — hard-gated to ADMIN_EMAILS only
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
      const dest = request.nextUrl.clone();
      dest.pathname = "/auth";
      return NextResponse.redirect(dest);
    }
    return response;
  }

  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected) {
    // getUser() makes a live call to the Supabase Auth API — only pay this cost
    // on routes that actually need it. Public routes use getSession() (cookie only).
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const onboarding = request.nextUrl.clone();
      onboarding.pathname = "/onboarding";
      return NextResponse.redirect(onboarding);
    }
  } else {
    // Refresh the session cookie without making a network call to Auth API.
    await supabase.auth.getSession();
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT static assets and Next internals:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico
     * - *.{png,jpg,jpeg,gif,svg,webp,ico}
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
