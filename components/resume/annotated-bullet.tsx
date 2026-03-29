"use client";

import { useState, useRef, useEffect } from "react";
import { LockToggle } from "@/components/resume/lock-toggle";
import { cn } from "@/lib/utils";
import type { AnnotatedBullet as AnnotatedBulletType, LockState } from "@/lib/types";
import { Pencil, Check, X } from "lucide-react";

interface Props {
  bullet: AnnotatedBulletType;
  onUpdate: (id: string, patch: Partial<Omit<AnnotatedBulletType, "id">>) => void;
  onDelete: (id: string) => void;
}

export function AnnotatedBullet({ bullet, onUpdate, onDelete }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(bullet.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus + auto-size when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      autoResize(el);
    }
  }, [isEditing]);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function commitEdit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      onDelete(bullet.id);
    } else {
      onUpdate(bullet.id, { text: trimmed });
    }
    setIsEditing(false);
  }

  function cancelEdit() {
    setDraft(bullet.text);
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === "Escape") {
      cancelEdit();
    }
  }

  const isLocked = bullet.lock === "locked";

  return (
    <div
      className={cn(
        "group flex gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5 transition-all duration-150",
        "border-l-4",
        isLocked ? "border-l-indigo-400" : "border-l-amber-300"
      )}
    >
      {/* Lock toggle */}
      <div className="shrink-0 mt-0.5">
        <LockToggle
          value={bullet.lock}
          onChange={(lock: LockState) => onUpdate(bullet.id, { lock })}
        />
      </div>

      {/* Bullet text / edit field */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              autoResize(e.target);
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            className="w-full resize-none bg-transparent text-sm text-gray-900 leading-relaxed outline-none placeholder:text-gray-300"
            placeholder="Describe what you did..."
          />
        ) : (
          <p className="text-sm text-gray-800 leading-relaxed">{bullet.text}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-start gap-1 shrink-0 mt-0.5">
        {isEditing ? (
          <>
            <button
              onClick={commitEdit}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              title="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={cancelEdit}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              setDraft(bullet.text);
              setIsEditing(true);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-500 transition-all"
            title="Edit bullet"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
