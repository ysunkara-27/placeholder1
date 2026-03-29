"use client";

import { useState } from "react";
import Link from "next/link";
import { ChatInterface } from "@/components/resume/chat-interface";
import { ResumePreview } from "@/components/resume/resume-preview";
import type { ResumeProfile } from "@/lib/types";
import { ChevronLeft, Eye, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ResumePage() {
  const [resume, setResume] = useState<Partial<ResumeProfile>>({});
  // Mobile view toggle
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");

  function handleResumeUpdate(patch: Partial<ResumeProfile>) {
    setResume((prev) => {
      const next = { ...prev };

      if (patch.name) next.name = patch.name;
      if (patch.email) next.email = patch.email;
      if (patch.phone) next.phone = patch.phone;

      if (patch.education?.length) {
        next.education = [...(prev.education ?? []), ...patch.education];
      }
      if (patch.experience?.length) {
        next.experience = [...(prev.experience ?? []), ...patch.experience];
      }
      if (patch.skills?.length) {
        const existing = new Set(prev.skills ?? []);
        next.skills = [
          ...(prev.skills ?? []),
          ...patch.skills.filter((s) => !existing.has(s)),
        ];
      }
      if (patch.excess_pool?.length) {
        next.excess_pool = [
          ...(prev.excess_pool ?? []),
          ...patch.excess_pool,
        ];
      }

      return next;
    });
  }

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/onboarding"
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Link>
          <span className="text-gray-200">/</span>
          <span className="text-sm font-semibold text-gray-900">
            Resume Builder
          </span>
        </div>

        {/* Mobile view toggle */}
        <div className="flex md:hidden gap-1 p-0.5 bg-gray-100 rounded-lg">
          <button
            onClick={() => setMobileView("chat")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              mobileView === "chat"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            onClick={() => setMobileView("preview")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              mobileView === "preview"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>
      </header>

      {/* Main split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Chat */}
        <div
          className={cn(
            "flex flex-col border-r border-gray-100",
            "w-full md:w-1/2",
            mobileView !== "chat" && "hidden md:flex"
          )}
        >
          <div className="px-5 py-4 border-b border-gray-50 shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">
              Chat with Claude
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Dump your experience — I&apos;ll structure it into STAR bullets
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatInterface onResumeUpdate={handleResumeUpdate} />
          </div>
        </div>

        {/* Right — Preview */}
        <div
          className={cn(
            "flex flex-col bg-gray-50",
            "w-full md:w-1/2",
            mobileView !== "preview" && "hidden md:flex"
          )}
        >
          <div className="px-5 py-4 border-b border-gray-100 bg-white shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">
              Resume Preview
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Updates as you chat
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ResumePreview resume={resume} />
          </div>
        </div>
      </div>
    </div>
  );
}
