"use client";

import { motion } from "framer-motion";
import { Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LockState } from "@/lib/types";

interface LockToggleProps {
  value: LockState;
  onChange: (next: LockState) => void;
  size?: "sm" | "md";
  className?: string;
}

export function LockToggle({
  value,
  onChange,
  size = "sm",
  className,
}: LockToggleProps) {
  const isLocked = value === "locked";

  const dims =
    size === "sm"
      ? { outer: "h-7 w-[52px]", pill: "h-5 w-5", text: "hidden" }
      : { outer: "h-8 w-[64px]", pill: "h-6 w-6", text: "text-[10px]" };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLocked}
      aria-label={isLocked ? "Locked — click to make flexible" : "Flexible — click to lock"}
      onClick={() => onChange(isLocked ? "flexible" : "locked")}
      title={isLocked ? "Locked — stays word-for-word" : "Flexible — optimized per job"}
      className={cn(
        "relative flex items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 shrink-0",
        dims.outer,
        isLocked
          ? "bg-indigo-50 border-indigo-200 focus-visible:ring-indigo-500"
          : "bg-amber-50 border-amber-200 focus-visible:ring-amber-400",
        className
      )}
    >
      {/* Sliding indicator */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className={cn(
          "absolute flex items-center justify-center rounded-full shadow-sm",
          dims.pill,
          isLocked
            ? "left-[3px] bg-indigo-600 text-white"
            : "left-[calc(100%-3px)] -translate-x-full bg-amber-500 text-white"
        )}
      >
        {isLocked ? (
          <Lock className="w-2.5 h-2.5" />
        ) : (
          <Sparkles className="w-2.5 h-2.5" />
        )}
      </motion.div>

      {/* Background icons (subtle) */}
      <Lock
        className={cn(
          "absolute left-[5px] w-2.5 h-2.5 transition-opacity",
          isLocked ? "opacity-0" : "opacity-20 text-indigo-400"
        )}
      />
      <Sparkles
        className={cn(
          "absolute right-[5px] w-2.5 h-2.5 transition-opacity",
          isLocked ? "opacity-20 text-amber-400" : "opacity-0"
        )}
      />
    </button>
  );
}
