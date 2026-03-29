"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { NotificationPref } from "@/lib/types";
import { MessageSquare, Mail } from "lucide-react";

interface Props {
  notification: NotificationPref;
  phone: string;
  email: string;
  onChange: (fields: {
    notification?: NotificationPref;
    phone?: string;
    email?: string;
  }) => void;
}

const NOTIFICATION_OPTIONS = [
  {
    value: "sms" as const,
    label: "SMS",
    description: "Instant text alerts. Reply YES to apply in seconds.",
    icon: MessageSquare,
    badge: "Fastest",
  },
  {
    value: "email" as const,
    label: "Email",
    description: "Clean email alerts with a one-click apply button.",
    icon: Mail,
    badge: null,
  },
];

export function StepNotifications({
  notification,
  phone,
  email,
  onChange,
}: Props) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          How should we alert you?
        </h1>
        <p className="text-gray-500">
          Speed matters — jobs fill up within hours of posting.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {NOTIFICATION_OPTIONS.map(({ value, label, description, icon: Icon, badge }) => {
          const isSelected = notification === value;
          return (
            <button
              key={value}
              onClick={() => onChange({ notification: value })}
              className={cn(
                "relative flex flex-col gap-3 rounded-xl border p-5 text-left transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
                isSelected
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              {badge && (
                <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {badge}
                </span>
              )}
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                  isSelected
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-500"
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{label}</p>
                <p className="text-sm text-gray-500 mt-0.5">{description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Contact fields */}
      <div className="space-y-4">
        <Input
          label="Email address"
          type="email"
          placeholder="you@university.edu"
          value={email}
          onChange={(e) => onChange({ email: e.target.value })}
          autoComplete="email"
        />

        {notification === "sms" && (
          <div className="animate-slide-up">
            <Input
              label="Phone number"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              autoComplete="tel"
              hint="US numbers only. Standard messaging rates apply."
            />
          </div>
        )}
      </div>
    </div>
  );
}
