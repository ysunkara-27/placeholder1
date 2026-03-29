"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { StepProfile } from "@/components/onboarding/step-profile";
import { StepPreferences } from "@/components/onboarding/step-preferences";
import { StepResume } from "@/components/onboarding/step-resume";
import { StepPhone } from "@/components/onboarding/step-phone";
import { Button } from "@/components/ui/button";
import type {
  Industry,
  JobLevel,
  GrayAreaSuggestion,
  AnnotatedResume,
} from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  extractResumeFromProfileRow,
  mapProfileRowToPersistedProfile,
  mapProfileToUpsertInput,
  type ProfileRow,
} from "@/lib/platform/profile";
import { Check, ChevronRight, ChevronLeft } from "lucide-react";

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "profile",     label: "Profile",     hint: "Who you are" },
  { id: "preferences", label: "Preferences", hint: "What you want" },
  { id: "resume",      label: "Resume",      hint: "Your experience" },
  { id: "phone",       label: "Twin",        hint: "Stay connected" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  // Step 1
  name: string;
  email: string;
  school: string;
  degree: string;
  graduation: string;
  gpa: string;
  // Step 2
  industries: Industry[];
  levels: JobLevel[];
  locations: string[];
  remote_ok: boolean;
  gray_areas: GrayAreaSuggestion | null;
  // Step 3
  annotatedResume: AnnotatedResume | null;
  // Step 4
  phone: string;
}

const INITIAL: FormState = {
  name: "", email: "",
  school: "", degree: "", graduation: "", gpa: "",
  industries: [], levels: [],
  locations: [], remote_ok: false, gray_areas: null,
  annotatedResume: null,
  phone: "",
};

// ─── Validation ───────────────────────────────────────────────────────────────

function isStepValid(step: StepId, form: FormState): boolean {
  switch (step) {
    case "profile":
      return (
        form.name.trim().length > 0 &&
        form.email.includes("@") &&
        form.school.trim().length > 0 &&
        form.degree.trim().length > 0 &&
        form.graduation.trim().length > 0
      );
    case "preferences":
      return (
        form.industries.length > 0 &&
        form.levels.length > 0 &&
        (form.locations.length > 0 || form.remote_ok) &&
        form.gray_areas !== null
      );
    case "resume":
      return form.annotatedResume !== null;
    case "phone":
      return form.phone.length >= 10 || form.phone === "";
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
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const currentStep = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const canAdvance = ready && !saving && isStepValid(currentStep.id, form);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        let userId = session?.user.id;

        if (!userId) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          if (!data.user?.id) {
            throw new Error("Supabase anonymous auth did not return a user.");
          }
          userId = data.user.id;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (error) throw error;

        const profileRow = data as ProfileRow | null;

        if (active && profileRow) {
          setForm((current) => ({
            ...current,
            ...mapProfileRowToPersistedProfile(profileRow),
            annotatedResume: extractResumeFromProfileRow(profileRow),
          }));
        }
      } catch (error) {
        if (active) {
          setAuthError(
            error instanceof Error
              ? error.message
              : "Failed to connect onboarding to Supabase."
          );
        }
      } finally {
        if (active) {
          setReady(true);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  function update(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function goNext() {
    if (!canAdvance) return;
    if (isLast) {
      setSaving(true);
      setAuthError(null);

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user.id) {
          throw new Error("Missing Supabase session. Refresh and try again.");
        }

        const { annotatedResume, ...profile } = form;
        const payload = mapProfileToUpsertInput({
          userId: session.user.id,
          profile,
          resume: annotatedResume,
        });

        const { error } = await supabase.from("profiles").upsert(payload);

        if (error) {
          throw error;
        }

        // Link the anonymous session to the user's email so they can sign back
        // in later. updateUser() sends a verification email; we navigate to the
        // dashboard immediately and let them verify in the background.
        // If the email is already linked (e.g. returning to onboarding) this
        // is a no-op — we ignore the error and move on.
        if (form.email) {
          await supabase.auth.updateUser({ email: form.email });
        }

        router.push("/dashboard");
      } catch (error) {
        setAuthError(
          error instanceof Error
            ? error.message
            : "Failed to save your profile."
        );
      } finally {
        setSaving(false);
      }

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

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
        <span className="text-lg font-semibold tracking-tight text-gray-900">
          Twin
        </span>
        <StepCircles steps={STEPS} currentIndex={stepIndex} />
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-lg">
          {!ready ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
            </div>
          ) : (
            <>
              {authError && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {authError}
                </div>
              )}

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {currentStep.id === "profile" && (
                <StepProfile
                  name={form.name}
                  email={form.email}
                  school={form.school}
                  degree={form.degree}
                  graduation={form.graduation}
                  gpa={form.gpa}
                  onChange={(patch) => update(patch)}
                />
              )}
              {currentStep.id === "preferences" && (
                <StepPreferences
                  industries={form.industries}
                  levels={form.levels}
                  locations={form.locations}
                  remoteOk={form.remote_ok}
                  grayAreas={form.gray_areas}
                  onChange={(patch) => update(patch as Partial<FormState>)}
                />
              )}
              {currentStep.id === "resume" && (
                <StepResume
                  value={form.annotatedResume}
                  onChange={(annotatedResume) => update({ annotatedResume })}
                />
              )}
              {currentStep.id === "phone" && (
                <StepPhone
                  phone={form.phone}
                  name={form.name}
                  onChange={(phone) => update({ phone })}
                  onSkip={() => {
                    update({ phone: "" });
                    void goNext();
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Nav */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={stepIndex === 0}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            <Button onClick={() => void goNext()} disabled={!canAdvance}>
              {isLast ? (saving ? "Saving..." : "Finish setup") : "Continue"}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Step circle progress indicator ──────────────────────────────────────────

function StepCircles({
  steps,
  currentIndex,
}: {
  steps: typeof STEPS;
  currentIndex: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 ${
                done
                  ? "bg-indigo-600 text-white"
                  : active
                  ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                  : "bg-gray-100 text-gray-400"
              }`}
              aria-label={`Step ${i + 1}: ${step.label}`}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-6 transition-colors duration-300 ${
                  done ? "bg-indigo-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
