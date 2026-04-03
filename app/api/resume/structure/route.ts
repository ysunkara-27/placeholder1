import { NextRequest, NextResponse } from "next/server";
import { getClaudeClient, STRUCTURE_SYSTEM_PROMPT } from "@/lib/claude";
import type { AnnotatedResume } from "@/lib/types";
import { MAX_RESUME_TEXT_CHARS } from "@/lib/upload-limits";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { text }: { text: string } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (text.length > MAX_RESUME_TEXT_CHARS) {
      return NextResponse.json(
        {
          error: `Resume text is too long. Keep it under ${MAX_RESUME_TEXT_CHARS.toLocaleString()} characters.`,
        },
        { status: 400 }
      );
    }

    const client = getClaudeClient();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: STRUCTURE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Parse this resume into structured JSON:\n\n${text}`,
        },
      ],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    // Try direct parse first
    let parsed: AnnotatedResume;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Fallback: extract the outermost JSON object via regex
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) {
        return NextResponse.json(
          { error: "Claude did not return valid JSON" },
          { status: 422 }
        );
      }
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return NextResponse.json(
          { error: "Failed to parse Claude's JSON response" },
          { status: 422 }
        );
      }
    }

    // Minimal shape validation
    if (!parsed.experience || !parsed.skills) {
      return NextResponse.json(
        { error: "Resume structure missing required fields" },
        { status: 422 }
      );
    }

    // Ensure excess_pool exists (Claude sometimes omits empty arrays)
    parsed.excess_pool = parsed.excess_pool ?? [];

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[resume/structure]", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
