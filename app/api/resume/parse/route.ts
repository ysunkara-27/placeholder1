import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import {
  formatLimitBytes,
  MAX_RESUME_PDF_BYTES,
  MAX_RESUME_TEXT_CHARS,
} from "@/lib/upload-limits";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    if (file.size > MAX_RESUME_PDF_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${formatLimitBytes(MAX_RESUME_PDF_BYTES)})` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text } = await pdfParse(buffer);

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from PDF. It may be scanned or image-based." },
        { status: 422 }
      );
    }

    // Normalize whitespace
    const cleaned = text
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (cleaned.length > MAX_RESUME_TEXT_CHARS) {
      return NextResponse.json(
        {
          error: `Resume text is too long (${cleaned.length.toLocaleString()} characters). Keep it under ${MAX_RESUME_TEXT_CHARS.toLocaleString()} characters.`,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: cleaned });
  } catch (err) {
    console.error("[resume/parse]", err);
    return NextResponse.json(
      { error: "Failed to parse PDF" },
      { status: 500 }
    );
  }
}
