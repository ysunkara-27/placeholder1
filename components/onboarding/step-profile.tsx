"use client";

import { Input } from "@/components/ui/input";

interface Props {
  name: string;
  email: string;
  school: string;
  degree: string;
  graduation: string;
  gpa: string;
  onChange: (patch: Partial<{
    name: string;
    email: string;
    school: string;
    degree: string;
    graduation: string;
    gpa: string;
  }>) => void;
}

export function StepProfile({
  name, email, school, degree, graduation, gpa, onChange,
}: Props) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Let&apos;s start with you
        </h1>
        <p className="text-gray-500">
          Basic info so your Twin knows who to apply for.
        </p>
      </div>

      <div className="space-y-4">
        <Input
          label="Full name"
          placeholder="Yashaswi Sunkara"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          autoComplete="name"
          autoFocus
        />

        <Input
          label="Email address"
          type="email"
          placeholder="you@university.edu"
          value={email}
          onChange={(e) => onChange({ email: e.target.value })}
          autoComplete="email"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="University"
            placeholder="University of Virginia"
            value={school}
            onChange={(e) => onChange({ school: e.target.value })}
            autoComplete="organization"
          />
          <Input
            label="Degree"
            placeholder="B.S. Computer Science"
            value={degree}
            onChange={(e) => onChange({ degree: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Graduation"
            placeholder="May 2026"
            value={graduation}
            onChange={(e) => onChange({ graduation: e.target.value })}
          />
          <Input
            label="GPA"
            placeholder="3.7"
            value={gpa}
            onChange={(e) => onChange({ gpa: e.target.value })}
            hint="Optional"
          />
        </div>
      </div>
    </div>
  );
}
