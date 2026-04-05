import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAILS = ["sunkarayashaswi@gmail.com", "surajnvaddi@gmail.com", "sunkara.yashaswi@gmail.com"];

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview"; // only model used

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildFallbackSummary(text: string): string | null {
  const cleaned = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => (
      line.length >= 40 &&
      !/^job description\b/i.test(line) &&
      !/^job summary\b/i.test(line) &&
      !/^description summary\b/i.test(line) &&
      !/^overview\b$/i.test(line) &&
      !/^about the role\b$/i.test(line) &&
      !/^about us\b$/i.test(line) &&
      !/^responsibilities\b$/i.test(line) &&
      !/^requirements\b$/i.test(line) &&
      !/^qualifications\b$/i.test(line) &&
      !/^what you('|’)ll do\b$/i.test(line) &&
      !/^what we('|’)re looking for\b$/i.test(line) &&
      !/^extracted via\b/i.test(line) &&
      !/^generic html rules\b/i.test(line) &&
      !/^apply\b/i.test(line) &&
      !/^save\b/i.test(line) &&
      !/^share\b/i.test(line) &&
      !/^click\b/i.test(line) &&
      !/^privacy\b/i.test(line) &&
      !/^cookie\b/i.test(line) &&
      !/^equal opportunity\b/i.test(line)
    ));

  if (cleaned.length === 0) return null;

  const picked: string[] = [];
  for (const line of cleaned) {
    const normalized = line
      .replace(/^[-*]\s*/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (normalized.length < 40) continue;
    if (picked.some((existing) => existing.includes(line) || line.includes(existing))) continue;
    picked.push(normalized);
    if (picked.length === 4) break;
  }

  const summary = picked.join(" ").replace(/\s{2,}/g, " ").trim();
  return summary.length >= 80 ? summary.slice(0, 1600) : null;
}

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
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Try to extract the job description container before stripping all HTML.
    // These selectors cover Greenhouse, Lever, and generic job boards.
    const jdPatterns = [
      // Greenhouse
      /<div[^>]+id=["']content["'][^>]*>([\s\S]*?)<\/div>/i,
      /<section[^>]+class=["'][^"']*posting-description[^"']*["'][^>]*>([\s\S]*?)<\/section>/i,
      // Lever
      /<div[^>]+class=["'][^"']*posting-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      // Generic: main, article, or large role/description divs
      /<div[^>]+class=["'][^"']*(?:job-?description|jd|role-?description|description)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<main[^>]*>([\s\S]*?)<\/main>/i,
    ];

    let extracted = "";
    for (const pattern of jdPatterns) {
      const match = html.match(pattern);
      if (match?.[1] && match[1].length > 200) {
        extracted = match[1];
        break;
      }
    }

    // Fall back to full page if no container found
    const raw = extracted || html;

    return stripHtml(raw).slice(0, 8000);
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
    if (!jd_summary && !suggestions.jd_summary && pageText) {
      const fallbackSummary = buildFallbackSummary(pageText);
      if (fallbackSummary) suggestions.jd_summary = fallbackSummary;
    }

    return NextResponse.json({ suggestions });
  } catch {
    if (!jd_summary && pageText) {
      const fallbackSummary = buildFallbackSummary(pageText);
      if (fallbackSummary) {
        return NextResponse.json({ suggestions: { jd_summary: fallbackSummary } });
      }
    }
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
  }
}
