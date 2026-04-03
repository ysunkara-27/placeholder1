import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatLimitBytes, MAX_RESUME_PDF_BYTES } from "@/lib/upload-limits";

export const runtime = "nodejs";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service credentials not configured");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("userId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: "No userId provided" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }
    if (file.size > MAX_RESUME_PDF_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${formatLimitBytes(MAX_RESUME_PDF_BYTES)})` },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const storagePath = `${userId}/resume.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[resume/upload] storage upload error:", uploadError.message);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Generate a long-lived signed URL (1 year)
    const { data: signedData, error: signError } = await supabase.storage
      .from("resumes")
      .createSignedUrl(storagePath, 365 * 24 * 3600);

    if (signError || !signedData?.signedUrl) {
      console.error("[resume/upload] signed URL error:", signError?.message);
      return NextResponse.json({ error: "Failed to generate resume URL" }, { status: 500 });
    }

    // Persist resume_url to profile row
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ resume_url: signedData.signedUrl })
      .eq("id", userId);

    if (profileError) {
      console.error("[resume/upload] profile update error:", profileError.message);
      // Non-fatal — return the URL anyway so client can use it
    }

    return NextResponse.json({ resumeUrl: signedData.signedUrl });
  } catch (err) {
    console.error("[resume/upload]", err);
    return NextResponse.json({ error: "Failed to upload resume" }, { status: 500 });
  }
}
