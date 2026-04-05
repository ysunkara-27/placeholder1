"use client";

interface Stat {
  label: string;
  value: number;
  description: string;
  active?: boolean;
}

interface Props {
  applied: number;
  pending: number;
  matched: number;
}

export function TwinStats({ applied, pending, matched }: Props) {
  const stats: Stat[] = [
    {
      label: "Applied",
      value: applied,
      description: "Submitted by your Twin",
    },
    {
      label: "Pending",
      value: pending,
      description: "Waiting on confirmation or execution",
      active: pending > 0,
    },
    {
      label: "Matched",
      value: matched,
      description: "Relevant jobs found for your profile",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="space-y-3 rounded-[24px] border border-rim bg-white p-5 shadow-soft-card"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-dim">
              {stat.label}
            </span>
            {stat.active && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/50 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-ink tabular-nums">
            {stat.value}
          </p>
          <p className="text-xs text-dim">{stat.description}</p>
        </div>
      ))}
    </div>
  );
}
