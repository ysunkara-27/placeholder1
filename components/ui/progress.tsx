"use client";

interface ProgressProps {
  value: number; // 0–100
  className?: string;
}

export function Progress({ value, className }: ProgressProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-1 w-full bg-gray-100 rounded-full overflow-hidden ${className ?? ""}`}
    >
      <div
        className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
