import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("alerts")
    .select(`
      id,
      status,
      alerted_at,
      replied_at,
      jobs (
        company,
        title,
        location,
        level,
        remote,
        application_url
      )
    `)
    .eq("user_id", user.id)
    .order("alerted_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const alerts = (data ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    alerted_at: row.alerted_at,
    replied_at: row.replied_at,
    job: Array.isArray(row.jobs) ? row.jobs[0] ?? null : row.jobs ?? null,
  }));

  return NextResponse.json({ alerts });
}
