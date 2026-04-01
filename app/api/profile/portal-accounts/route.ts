import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_PORTALS = [
  "workday",
  "icims",
  "greenhouse",
  "lever",
  "ashby",
  "handshake",
] as const;

type PortalName = (typeof ALLOWED_PORTALS)[number];

interface PortalCreds {
  email: string;
  password: string;
}

// GET: returns the current portal_accounts (passwords omitted — just presence booleans)
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const accounts: Record<string, unknown> = ((data as any)?.portal_accounts as Record<string, unknown>) ?? {};
  // Return presence info + masked email (never return passwords to the client)
  const result: Record<string, { email: string; configured: boolean }> = {};
  for (const portal of ALLOWED_PORTALS) {
    const creds = accounts[portal] as PortalCreds | undefined;
    result[portal] = {
      email: creds?.email ?? "",
      configured: !!(creds?.email && creds?.password),
    };
  }

  return NextResponse.json({ accounts: result });
}

// PUT: set credentials for one portal
export async function PUT(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { portal, email, password } = body as {
    portal: PortalName;
    email: string;
    password: string;
  };

  if (!ALLOWED_PORTALS.includes(portal)) {
    return NextResponse.json({ error: "Unknown portal" }, { status: 400 });
  }
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  // Fetch current to merge, not overwrite other portals
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const current: Record<string, unknown> = ((existing as any)?.portal_accounts as Record<string, unknown>) ?? {};
  const updated = {
    ...current,
    [portal]: { email: email.trim(), password },
  };

  const { error } = await (supabase.from("profiles") as any)
    .update({ portal_accounts: updated })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE: remove credentials for one portal
export async function DELETE(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { portal } = await req.json() as { portal: PortalName };
  if (!ALLOWED_PORTALS.includes(portal)) {
    return NextResponse.json({ error: "Unknown portal" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const current: Record<string, unknown> = ((existing as any)?.portal_accounts as Record<string, unknown>) ?? {};
  const { [portal]: _removed, ...updated } = current;

  const { error } = await (supabase.from("profiles") as any)
    .update({ portal_accounts: updated })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
