"use client";

import { useState, useEffect, useRef } from "react";
import { PdfUploader } from "@/components/resume/pdf-uploader";
import { ResumeAnnotator } from "@/components/resume/resume-annotator";
import type { AnnotatedResume } from "@/lib/types";
import { Loader2, ExternalLink } from "lucide-react";

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
}

export function StepResume({ value, onChange }: Props) {
  const [phase, setPhase] = useState<Phase>(value ? "annotate" : "upload");
  const [structuringMsg, setStructuringMsg] = useState(STRUCTURING_MESSAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const msgInterval = useRef<ReturnType<typeof setInterval> | null>(null);

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

  async function handlePdfParsed(text: string) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to structure resume");
      setPhase("error");
    }
  }

  if (phase === "upload") {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Upload your resume
          </h1>
          <p className="text-gray-500">
            We&apos;ll parse every bullet so you can choose what stays locked and
            what your Twin can tailor per job.
          </p>
        </div>

        <PdfUploader onParsed={handlePdfParsed} />

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-1.5">
          <p className="text-sm font-medium text-gray-700">What happens next:</p>
          <ul className="space-y-1">
            {[
              "Claude parses your resume into structured sections",
              "You mark each bullet as Locked (verbatim) or Flexible (optimize per job)",
              "Your Twin uses this to tailor every application automatically",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                <span className="text-indigo-400 shrink-0 mt-0.5">{i + 1}.</span>
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
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Reading your resume...
          </h1>
          <p className="text-gray-500">This takes a few seconds.</p>
        </div>

        <div className="flex flex-col items-center justify-center py-16 gap-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-indigo-300 animate-spin" style={{ animationDirection: "reverse" }} />
            </div>
          </div>
          <p className="text-sm text-gray-500 animate-fade-in text-center">
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
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Couldn&apos;t parse your resume
          </h1>
          <p className="text-gray-500">
            {error ?? "Something went wrong. Try again or use the chat builder."}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => setPhase("upload")}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors"
          >
            Try a different PDF
          </button>
          <a
            href="/resume"
            target="_blank"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Type your experience instead
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  // annotate phase
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Lock what matters, flex the rest
        </h1>
        <p className="text-gray-500">
          Your Twin can optimize flexible bullets for each job&apos;s keywords.
          Lock anything that must stay exactly as-is.
        </p>
      </div>

      <ResumeAnnotator
        resume={value!}
        onChange={onChange}
      />
    </div>
  );
}
