import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ADMIN_EMAILS = ["sunkarayashaswi@gmail.com", "surajnvaddi@gmail.com", "sunkara.yashaswi@gmail.com"];

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview"; // only model used

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

  const { company, title, level, location, industries } = await request.json() as {
    company: string;
    title: string;
    level: string;
    location: string;
    industries: string[];
  };

  const VALID_INDUSTRIES = ["SWE","Data","PM","Design","Hardware","MechEng","CivilEng","ChemEng","AeroEng","LifeSci","Research","Healthcare","Finance","Consulting","Marketing","Operations","Sales","Policy","Education"];

  const prompt = `Normalize this job posting data scraped from the web. Return ONLY valid JSON, no markdown.

Input:
company: "${company}"
title: "${title}"
level: "${level}"
location: "${location}"
industries: ${JSON.stringify(industries)}

Rules:
- company: remove legal suffixes (Inc, Inc., LLC, Corp, Corp., Ltd, Co, plc, GmbH, S.A., N.V., etc). Fix capitalization. Keep short brand name only.
- title: strip location info (e.g. "- New York, NY"), remove year/term refs (Summer 2026, Fall 2025, 2026 Intern), remove duplicate company name if prepended. Keep the core role name, preserve "Intern" / "Internship" / "Co-op" if present.
- level: valid values are internship, new_grad, co_op, associate, part_time. Only suggest a change if the title clearly implies a different level than what is given.
- location: standardize US cities to "City, ST" (e.g. "New York, NY"). For remote-only roles use "Remote". For international keep "City, Country". Strip zip codes and extra detail.
- industries: ALWAYS return this field. Pick 1-3 values from this exact list that best describe the role's function: ${VALID_INDUSTRIES.join(", ")}. Return as a JSON array. Use the job title and company as your signal.

Return a JSON object containing ONLY the fields that need changing, EXCEPT industries which must always be included.
Example: {"company": "Stripe", "title": "Software Engineer Intern", "industries": ["SWE"]}`;

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
          maxOutputTokens: 512,
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
    const suggestions = JSON.parse(text) as Record<string, unknown>;
    if (suggestions.company === company) delete suggestions.company;
    if (suggestions.title === title) delete suggestions.title;
    if (suggestions.level === level) delete suggestions.level;
    if (suggestions.location === location) delete suggestions.location;
    if (Array.isArray(suggestions.industries)) {
      const sorted = [...(suggestions.industries as string[])].sort().join(",");
      const currentSorted = [...industries].sort().join(",");
      if (sorted === currentSorted) delete suggestions.industries;
    }
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
  }
}
