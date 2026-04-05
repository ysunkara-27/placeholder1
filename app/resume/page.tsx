"use client";

import { useState } from "react";
import { ChatInterface } from "@/components/resume/chat-interface";
import { ResumePreview } from "@/components/resume/resume-preview";
import type { ResumeProfile } from "@/lib/types";
import { Eye, MessageSquare } from "lucide-react";
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
    <div className="flex flex-col h-screen bg-canvas overflow-hidden">
      <header className="flex justify-between items-center px-5 py-4 border-b border-rim bg-white shrink-0">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-dim">
            Resume Studio
          </p>
          <h1 className="mt-1 text-2xl leading-none text-ink">Build your resume with Twin</h1>
        </div>
        <div className="flex md:hidden gap-1 p-0.5 bg-surface rounded-lg">
          <button
            onClick={() => setMobileView("chat")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              mobileView === "chat"
                ? "bg-white text-ink shadow-soft-card"
                : "text-dim"
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
                ? "bg-white text-ink shadow-soft-card"
                : "text-dim"
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
            "flex flex-col border-r border-rim",
            "bg-white",
            "w-full md:w-1/2",
            mobileView !== "chat" && "hidden md:flex"
          )}
        >
          <div className="px-5 py-4 border-b border-rim shrink-0">
            <h2 className="text-sm font-semibold text-ink">
              Chat with Claude
            </h2>
            <p className="text-xs text-dim mt-0.5">
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
            "flex flex-col bg-surface",
            "w-full md:w-1/2",
            mobileView !== "preview" && "hidden md:flex"
          )}
        >
          <div className="px-5 py-4 border-b border-rim bg-white shrink-0">
            <h2 className="text-sm font-semibold text-ink">
              Resume Preview
            </h2>
            <p className="text-xs text-dim mt-0.5">
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
