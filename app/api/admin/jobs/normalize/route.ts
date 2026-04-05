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

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 8000);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const { company, title, level, location, industries, target_term, jd_summary, job_url } =
    await request.json() as {
      company: string;
      title: string;
      level: string;
      location: string;
      industries: string[];
      target_term: string | null;
      jd_summary: string | null;
      job_url: string | null;
    };

  const VALID_INDUSTRIES = [
    "SWE","Data","PM","Design","Hardware",
    "MechEng","CivilEng","ChemEng","AeroEng",
    "LifeSci","Research","Healthcare",
    "Finance","Consulting","Marketing","Operations","Sales",
    "Policy","Education",
  ];

  // Fetch real page content if we have a URL and no existing JD summary
  const pageText = (!jd_summary && job_url) ? await fetchPageText(job_url) : null;

  const prompt = `You are normalizing a job posting record in our database. Return ONLY valid JSON, no markdown.

Database record:
company: "${company}"
title: "${title}"
level: "${level}"
location: "${location}"
remote: (infer from location/title)
industries: ${JSON.stringify(industries)}
target_term: ${target_term ?? "null"}
jd_summary: ${jd_summary ?? "null"}
${pageText ? `\nRaw page content scraped from the job posting URL:\n"""\n${pageText}\n"""` : ""}

Rules — return ONLY fields that need to change:
- title: strip appended location (e.g. "- New York, NY"), remove year/term refs (Summer 2026, Fall 2025, 2026 Intern), remove prepended company name. Keep core role name; preserve "Intern" / "Internship" / "Co-op".
- level: valid values: internship, new_grad, co_op, associate, part_time. Only change if title clearly implies something different.
- location: standardize to "City, ST" for US (e.g. "New York, NY"), "Remote" for remote-only, "City, Country" for international. Strip zip codes and extra detail.
- industries: ALWAYS include. Pick 1-3 from: ${VALID_INDUSTRIES.join(", ")}. Return as a JSON array.
- target_term: ALWAYS include. Full program timeframe string — e.g. "2026 Summer", "2026 Fall", "Full Time". Extract year + season from title or page content. Use "Full Time" for permanent roles.
- jd_summary: ALWAYS include if jd_summary is currently null/empty. Extract the actual job description text from the page content above — copy the responsibilities and requirements directly, do not rephrase. 2-4 sentences max. If jd_summary already has a value, omit this field.

Return JSON with only changed fields (industries and target_term always included).
Example: {"title": "Software Engineer Intern", "industries": ["SWE"], "target_term": "2026 Summer", "jd_summary": "Build and maintain backend services..."}`;

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
          maxOutputTokens: 768,
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
    // Never suggest company changes
    delete suggestions.company;
    // Strip no-ops
    if (suggestions.title === title) delete suggestions.title;
    if (suggestions.level === level) delete suggestions.level;
    if (suggestions.location === location) delete suggestions.location;
    if (Array.isArray(suggestions.industries)) {
      const sorted = [...(suggestions.industries as string[])].sort().join(",");
      if (sorted === [...industries].sort().join(",")) delete suggestions.industries;
    }
    if (suggestions.target_term === target_term) delete suggestions.target_term;
    // Only keep jd_summary suggestion if current field is empty
    if (jd_summary) delete suggestions.jd_summary;

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
  }
}
