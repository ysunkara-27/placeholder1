"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { StepIndustries } from "@/components/onboarding/step-industries";
import { StepLevel } from "@/components/onboarding/step-level";
import { StepLocations } from "@/components/onboarding/step-locations";
import { StepNotifications } from "@/components/onboarding/step-notifications";
import { StepGrayAreas } from "@/components/onboarding/step-gray-areas";
import type {
  Industry,
  JobLevel,
  NotificationPref,
  GrayAreaSuggestion,
} from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: "industries", label: "Industries" },
  { id: "level", label: "Role Type" },
  { id: "locations", label: "Location" },
  { id: "notifications", label: "Alerts" },
  { id: "gray-areas", label: "Preferences" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  industries: Industry[];
  levels: JobLevel[];
  locations: string[];
  remote_ok: boolean;
  notification: NotificationPref;
  phone: string;
  email: string;
  gray_areas: GrayAreaSuggestion | null;
}

const INITIAL: FormState = {
  industries: [],
  levels: [],
  locations: [],
  remote_ok: false,
  notification: "email",
  phone: "",
  email: "",
  gray_areas: null,
};

// ─── Validation per step ──────────────────────────────────────────────────────

function isStepValid(step: StepId, form: FormState): boolean {
  switch (step) {
    case "industries":
      return form.industries.length > 0;
    case "level":
      return form.levels.length > 0;
    case "locations":
      return form.locations.length > 0 || form.remote_ok;
    case "notifications":
      return (
        form.email.includes("@") &&
        (form.notification === "email" || form.phone.length > 9)
      );
    case "gray-areas":
      return form.gray_areas !== null;
    default:
      return true;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [form, setForm] = useState<FormState>(INITIAL);

  const currentStep = STEPS[stepIndex];
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const canAdvance = isStepValid(currentStep.id, form);

  function goNext() {
    if (!canAdvance) return;
    if (stepIndex === STEPS.length - 1) {
      // Done — save to localStorage for now, route to resume builder
      localStorage.setItem("autoapply_onboarding", JSON.stringify(form));
      router.push("/resume");
      return;
    }
    setDirection(1);
    setStepIndex((i) => i + 1);
  }

  function goBack() {
    if (stepIndex === 0) return;
    setDirection(-1);
    setStepIndex((i) => i - 1);
  }

  function update(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 40 : -40,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? -40 : 40,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <span className="text-lg font-semibold text-gray-900 tracking-tight">
          AutoApply
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {stepIndex + 1} / {STEPS.length}
          </span>
          <div className="w-32">
            <Progress value={progress} />
          </div>
        </div>
      </header>

      {/* Step tabs */}
      <div className="border-b border-gray-100 px-6">
        <div className="flex gap-6 overflow-x-auto no-scrollbar">
          {STEPS.map((step, i) => (
            <button
              key={step.id}
              onClick={() => {
                if (i < stepIndex) {
                  setDirection(-1);
                  setStepIndex(i);
                }
              }}
              disabled={i > stepIndex}
              className={`py-3 text-sm font-medium border-b-2 shrink-0 transition-colors ${
                i === stepIndex
                  ? "border-indigo-600 text-indigo-600"
                  : i < stepIndex
                  ? "border-transparent text-gray-400 hover:text-gray-600 cursor-pointer"
                  : "border-transparent text-gray-300 cursor-default"
              }`}
            >
              {step.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {currentStep.id === "industries" && (
                <StepIndustries
                  selected={form.industries}
                  onChange={(industries) => update({ industries })}
                />
              )}
              {currentStep.id === "level" && (
                <StepLevel
                  selected={form.levels}
                  onChange={(levels) => update({ levels })}
                />
              )}
              {currentStep.id === "locations" && (
                <StepLocations
                  locations={form.locations}
                  remoteOk={form.remote_ok}
                  onChange={(locations, remote_ok) =>
                    update({ locations, remote_ok })
                  }
                />
              )}
              {currentStep.id === "notifications" && (
                <StepNotifications
                  notification={form.notification}
                  phone={form.phone}
                  email={form.email}
                  onChange={(fields) => update(fields)}
                />
              )}
              {currentStep.id === "gray-areas" && (
                <StepGrayAreas
                  industries={form.industries}
                  levels={form.levels}
                  locations={form.locations}
                  value={form.gray_areas}
                  onChange={(gray_areas) => update({ gray_areas })}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={stepIndex === 0}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            <Button onClick={goNext} disabled={!canAdvance}>
              {stepIndex === STEPS.length - 1 ? "Build my resume" : "Continue"}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
