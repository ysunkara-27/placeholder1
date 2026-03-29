import { NextRequest, NextResponse } from "next/server";
import { getClaudeClient, GRAY_AREAS_SYSTEM_PROMPT } from "@/lib/claude";
import type { GrayAreaSuggestion, Industry, JobLevel } from "@/lib/types";

export const runtime = "nodejs";

interface RequestBody {
  industries: Industry[];
  levels: JobLevel[];
  locations: string[];
}

export async function POST(req: NextRequest) {
  try {
    const { industries, levels, locations }: RequestBody = await req.json();

    if (!industries?.length || !levels?.length) {
      return NextResponse.json(
        { error: "industries and levels are required" },
        { status: 400 }
      );
    }

    const prompt = `
The user is a college student/recent grad with the following job search profile:
- Target industries: ${industries.join(", ")}
- Job levels: ${levels.join(", ")}
- Preferred locations: ${locations.length ? locations.join(", ") : "flexible"}

Generate smart suggestions for their gray-area preferences. Return only the JSON object — no markdown, no explanation.
`.trim();

    const client = getClaudeClient();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: GRAY_AREAS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Strip markdown fences if Claude wrapped the JSON
    const jsonText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const suggestion: GrayAreaSuggestion = JSON.parse(jsonText);

    return NextResponse.json(suggestion);
  } catch (err) {
    console.error("[onboarding/gray-areas]", err);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
