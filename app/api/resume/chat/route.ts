import { NextRequest, NextResponse } from "next/server";
import { getClaudeClient, RESUME_SYSTEM_PROMPT } from "@/lib/claude";
import { MAX_RESUME_TEXT_CHARS } from "@/lib/upload-limits";

export const runtime = "nodejs";

interface MessageParam {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: MessageParam[] } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "messages is required" }, { status: 400 });
    }

    // Validate roles alternate correctly (Claude requires user/assistant alternation)
    const normalized: MessageParam[] = messages.filter((m) =>
      ["user", "assistant"].includes(m.role) && m.content.trim()
    );

    if (normalized.some((message) => message.content.length > MAX_RESUME_TEXT_CHARS)) {
      return NextResponse.json(
        {
          error: `Each resume message must stay under ${MAX_RESUME_TEXT_CHARS.toLocaleString()} characters.`,
        },
        { status: 400 }
      );
    }

    const client = getClaudeClient();

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: RESUME_SYSTEM_PROMPT,
      messages: normalized,
    });

    // Return SSE stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const data = JSON.stringify({ text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[resume/chat]", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
