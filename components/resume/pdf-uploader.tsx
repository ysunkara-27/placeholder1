"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import {
  formatLimitBytes,
  MAX_RESUME_PDF_BYTES,
  MAX_RESUME_TEXT_CHARS,
} from "@/lib/upload-limits";
import { Upload, FileText, X, Loader2 } from "lucide-react";

interface Props {
  onParsed: (text: string, file: File) => void;
}

export function PdfUploader({ onParsed }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const f = accepted[0];
      if (!f) return;
      setFile(f);
      setError(null);
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", f);

        const res = await fetch("/api/resume/parse", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const { error: msg } = await res.json();
          throw new Error(msg ?? "Failed to parse PDF");
        }

        const { text } = await res.json();
        onParsed(text, f);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse PDF");
        setFile(null);
      } finally {
        setUploading(false);
      }
    },
    [onParsed]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: MAX_RESUME_PDF_BYTES,
    disabled: uploading,
  });

  if (file && uploading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
          <p className="text-xs text-gray-400">Parsing your resume...</p>
        </div>
      </div>
    );
  }

  if (file && !uploading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <FileText className="w-5 h-5 text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-800 truncate">{file.name}</p>
          <p className="text-xs text-green-600">Imported successfully</p>
        </div>
        <button
          onClick={() => setFile(null)}
          className="shrink-0 text-green-400 hover:text-green-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer",
          "transition-all duration-150 text-center",
          isDragActive
            ? "border-indigo-400 bg-indigo-50"
            : "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn("w-6 h-6", isDragActive ? "text-indigo-500" : "text-gray-300")} />
        <div>
          <p className="text-sm font-medium text-gray-700">
            {isDragActive ? "Drop it here" : "Upload existing resume"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            PDF up to {formatLimitBytes(MAX_RESUME_PDF_BYTES)}. Extracted text must stay under {MAX_RESUME_TEXT_CHARS.toLocaleString()} characters.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 px-1">{error}</p>
      )}
    </div>
  );
}
