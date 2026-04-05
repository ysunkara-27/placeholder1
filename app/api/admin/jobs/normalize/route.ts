import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ADMIN_EMAILS = ["sunkarayashaswi@gmail.com", "surajnvaddi@gmail.com", "sunkara.yashaswi@gmail.com"];

// gemini-2.0-flash: fast, cheap, widely available
const GEMINI_MODEL = "gemini-2.0-flash";

async function assertAdmin(): Promise<NextResponse | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const { company, title, level, location } = await request.json() as {
    company: string;
    title: string;
    level: string;
    location: string;
  };

  const prompt = `Normalize this job posting data scraped from the web. Return ONLY valid JSON, no markdown.

Input:
company: "${company}"
title: "${title}"
level: "${level}"
location: "${location}"

Rules:
- company: remove legal suffixes (Inc, Inc., LLC, Corp, Corp., Ltd, Co, plc, GmbH, S.A., N.V., etc). Fix capitalization. Keep short brand name only.
- title: strip location info (e.g. "- New York, NY"), remove year/term refs (Summer 2026, Fall 2025, 2026 Intern), remove duplicate company name if prepended. Keep the core role name, preserve "Intern" / "Internship" / "Co-op" if present.
- level: valid values are internship, new_grad, co_op, associate, part_time. Only suggest a change if the title clearly implies a different level than what is given.
- location: standardize US cities to "City, ST" (e.g. "New York, NY"). For remote-only roles use "Remote". For international keep "City, Country". Strip zip codes and extra detail.

Return a JSON object containing ONLY the fields that actually need changing. If a field looks fine already, omit it entirely.
Example: {"company": "Stripe", "title": "Software Engineer Intern"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
          maxOutputTokens: 256,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 502 });
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  try {
    const suggestions = JSON.parse(text) as Record<string, string>;
    if (suggestions.company === company) delete suggestions.company;
    if (suggestions.title === title) delete suggestions.title;
    if (suggestions.level === level) delete suggestions.level;
    if (suggestions.location === location) delete suggestions.location;
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
  }
}
