"use client";

import { useState, useEffect, useRef } from "react";
import { PdfUploader } from "@/components/resume/pdf-uploader";
import { ResumeAnnotator } from "@/components/resume/resume-annotator";
import {
  isNearCharacterLimit,
  MAX_COVER_LETTER_CHARS,
} from "@/lib/upload-limits";
import type { AnnotatedResume } from "@/lib/types";
import { Loader2 } from "lucide-react";

type Phase = "upload" | "structuring" | "annotate" | "error";

const STRUCTURING_MESSAGES = [
  "Parsing your resume...",
  "Identifying experience sections...",
  "Extracting skills and keywords...",
  "Building your Twin's knowledge base...",
  "Almost there...",
];

interface Props {
  value: AnnotatedResume | null;
  onChange: (resume: AnnotatedResume) => void;
  onResumeUrl?: (url: string) => void;
  userId?: string;
  coverLetter: string;
  onCoverLetterChange: (v: string) => void;
}

export function StepResume({ value, onChange, onResumeUrl, userId, coverLetter, onCoverLetterChange }: Props) {
  const [phase, setPhase] = useState<Phase>(value ? "annotate" : "upload");
  const [structuringMsg, setStructuringMsg] = useState(STRUCTURING_MESSAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const pendingFile = useRef<File | null>(null);
  const msgInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const coverLetterLength = coverLetter.length;
  const nearCoverLetterLimit = isNearCharacterLimit(
    coverLetterLength,
    MAX_COVER_LETTER_CHARS
  );

  useEffect(() => {
    if (phase === "structuring") {
      let i = 0;
      msgInterval.current = setInterval(() => {
        i = (i + 1) % STRUCTURING_MESSAGES.length;
        setStructuringMsg(STRUCTURING_MESSAGES[i]);
      }, 1500);
    } else {
      if (msgInterval.current) clearInterval(msgInterval.current);
    }
    return () => {
      if (msgInterval.current) clearInterval(msgInterval.current);
    };
  }, [phase]);

  async function handlePdfParsed(text: string, file: File) {
    pendingFile.current = file;
    setPhase("structuring");
    setError(null);

    try {
      const res = await fetch("/api/resume/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? "Failed to structure resume");
      }

      const structured: AnnotatedResume = await res.json();
      onChange(structured);
      setPhase("annotate");

      // Upload the PDF to storage in the background
      if (userId && pendingFile.current) {
        const uploadForm = new FormData();
        uploadForm.append("file", pendingFile.current);
        uploadForm.append("userId", userId);
        fetch("/api/resume/upload", { method: "POST", body: uploadForm })
          .then((r) => r.json())
          .then((data: { resumeUrl?: string }) => {
            if (data.resumeUrl && onResumeUrl) onResumeUrl(data.resumeUrl);
          })
          .catch(() => {/* non-fatal */});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to structure resume");
      setPhase("error");
    }
  }

  if (phase === "upload") {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl leading-none text-ink">
            Upload your resume
          </h1>
          <p className="text-dim leading-7">
            We&apos;ll parse every bullet so you can choose what stays locked and
            what your Twin can tailor per job.
          </p>
        </div>

        <PdfUploader onParsed={(text, file) => handlePdfParsed(text, file)} />

        <div className="rounded-xl border border-rim bg-surface p-4 space-y-1.5 shadow-soft-card">
          <p className="text-sm font-medium text-ink">What happens next:</p>
          <ul className="space-y-1">
            {[
              "Claude parses your resume into structured sections",
              "You mark each bullet as Locked (verbatim) or Flexible (optimize per job)",
              "Your Twin uses this to tailor every application automatically",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-dim">
                <span className="text-accent shrink-0 mt-0.5">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (phase === "structuring") {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl leading-none text-ink">
            Reading your resume...
          </h1>
          <p className="text-dim">This takes a few seconds.</p>
        </div>

        <div className="flex flex-col items-center justify-center py-16 gap-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-accent-wash border-t-accent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-accent/40 animate-spin" style={{ animationDirection: "reverse" }} />
            </div>
          </div>
          <p className="text-sm text-dim animate-fade-in text-center">
            {structuringMsg}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl leading-none text-ink">
            Couldn&apos;t parse your resume
          </h1>
          <p className="text-dim leading-7">
            {error ?? "Something went wrong. Try again or use the chat builder."}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => { setPhase("upload"); setError(null); }}
            className="rounded-xl border border-rim bg-white px-4 py-3 text-sm font-medium text-ink hover:border-accent/30 transition-colors shadow-soft-card"
          >
            Try a different PDF
          </button>
          <p className="text-sm text-dim">
            If your PDF is image-based, try converting it to text first using{" "}
            <span className="font-medium text-ink">Adobe Acrobat</span> or{" "}
            <span className="font-medium text-ink">Smallpdf</span>, then re-upload.
          </p>
        </div>
      </div>
    );
  }

  // annotate phase
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl leading-none text-ink">
          Lock what matters, flex the rest
        </h1>
        <p className="text-dim leading-7">
          Your Twin can optimize flexible bullets for each job&apos;s keywords.
          Lock anything that must stay exactly as-is.
        </p>
      </div>

      <ResumeAnnotator
        resume={value!}
        onChange={onChange}
      />

      <div className="space-y-3 border-t border-rim pt-6">
        <div>
          <label className="text-sm font-medium text-ink">
            Cover letter template{" "}
            <span className="text-dim font-normal">(optional)</span>
          </label>
          <p className="text-xs text-dim mt-0.5">
            Your Twin will use this as a base and tailor it for each application.
            Leave blank to skip cover letters. Max {MAX_COVER_LETTER_CHARS.toLocaleString()} characters.
          </p>
        </div>
        <textarea
          value={coverLetter}
          onChange={(e) => onCoverLetterChange(e.target.value)}
          placeholder={"Dear Hiring Manager,\n\nI'm excited to apply for..."}
          rows={6}
          maxLength={MAX_COVER_LETTER_CHARS}
          className="w-full rounded-xl border border-rim bg-white px-4 py-3 text-sm text-ink placeholder:text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 resize-none transition-colors duration-150 shadow-soft-card"
        />
        <div className="flex justify-end">
          <p className={`text-xs ${nearCoverLetterLimit ? "text-amber-600" : "text-dim"}`}>
            {coverLetterLength.toLocaleString()} / {MAX_COVER_LETTER_CHARS.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
