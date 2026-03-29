"use client";

import { useState, useRef } from "react";
import { LockToggle } from "@/components/resume/lock-toggle";
import { cn, generateId } from "@/lib/utils";
import type { AnnotatedSkill as AnnotatedSkillType } from "@/lib/types";
import { Plus } from "lucide-react";

interface Props {
  skills: AnnotatedSkillType[];
  onChange: (skills: AnnotatedSkillType[]) => void;
}

export function AnnotatedSkillGrid({ skills, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function toggleLock(id: string) {
    onChange(
      skills.map((s) =>
        s.id === id
          ? { ...s, lock: s.lock === "locked" ? "flexible" : "locked" }
          : s
      )
    );
  }

  function addSkill() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    // Deduplicate (case-insensitive)
    if (skills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      setAdding(false);
      return;
    }
    onChange([
      ...skills,
      { id: generateId(), name: trimmed, lock: "flexible" },
    ]);
    setDraft("");
    setAdding(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
    if (e.key === "Escape") {
      setDraft("");
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => {
        const isLocked = skill.lock === "locked";
        return (
          <div
            key={skill.id}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer select-none",
              isLocked
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
            )}
            onClick={() => toggleLock(skill.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleLock(skill.id);
              }
            }}
            title={isLocked ? "Locked — click to make flexible" : "Flexible — click to lock"}
          >
            <LockToggle
              value={skill.lock}
              onChange={() => toggleLock(skill.id)}
              size="sm"
            />
            {skill.name}
          </div>
        );
      })}

      {/* Add skill */}
      {adding ? (
        <div className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 bg-white px-3 py-1.5">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addSkill}
            autoFocus
            placeholder="Skill name..."
            className="w-24 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-300"
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add skill
        </button>
      )}
    </div>
  );
}
