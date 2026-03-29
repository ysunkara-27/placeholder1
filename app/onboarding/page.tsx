"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { StepProfile } from "@/components/onboarding/step-profile";
import { StepEducation } from "@/components/onboarding/step-education";
import { StepPreferences } from "@/components/onboarding/step-preferences";
import { StepResume } from "@/components/onboarding/step-resume";
import { StepAutofill } from "@/components/onboarding/step-autofill";
import { Button } from "@/components/ui/button";
import type {
  Industry,
  JobLevel,
  GrayAreaSuggestion,
  AnnotatedResume,
  EEOData,
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
  { id: "personal",    label: "Personal",    hint: "About you" },
  { id: "education",   label: "Education",   hint: "School & work auth" },
  { id: "preferences", label: "Preferences", hint: "What you want" },
  { id: "resume",      label: "Resume",      hint: "Your experience" },
  { id: "autofill",    label: "Extras",      hint: "Optional autofill" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  // Step 1: personal
  name: string;
  phone: string;
  city: string;
  state_region: string;
  country: string;
  linkedin_url: string;
  website_url: string;
  github_url: string;
  // Step 2: education
  school: string;
  major: string;
  degree: string;
  gpa: string;
  graduation: string;
  authorized_to_work: boolean;
  visa_type: string;
  earliest_start_date: string;
  // Step 3: preferences
  industries: Industry[];
  levels: JobLevel[];
  locations: string[];
  remote_ok: boolean;
  gray_areas: GrayAreaSuggestion | null;
  // Step 4: resume
  annotatedResume: AnnotatedResume | null;
  // Step 5: autofill (optional)
  eeo: EEOData | null;
}

const INITIAL: FormState = {
  name: "", phone: "", city: "", state_region: "", country: "United States",
  linkedin_url: "", website_url: "", github_url: "",
  school: "", major: "", degree: "", gpa: "", graduation: "",
  authorized_to_work: true, visa_type: "", earliest_start_date: "",
  industries: [], levels: [], locations: [], remote_ok: false, gray_areas: null,
  annotatedResume: null,
  eeo: null,
};

// ─── Validation ───────────────────────────────────────────────────────────────

function isStepValid(step: StepId, form: FormState): boolean {
  switch (step) {
    case "personal":
      return form.name.trim().length > 0;
    case "education":
      return (
        form.school.trim().length > 0 &&
        form.major.trim().length > 0 &&
        form.degree.trim().length > 0 &&
        form.graduation.trim().length > 0 &&
        form.visa_type.length > 0 &&
        form.earliest_start_date.trim().length > 0
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
    case "autofill":
      return true; // all optional
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
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const currentStep = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const canAdvance = !saving && isStepValid(currentStep.id, form);

  async function ensureOnboardingSession() {
    const supabase = getSupabaseBrowserClient();
    const sessionResult = await supabase.auth.getSession();

    if (sessionResult.error) {
      throw sessionResult.error;
    }

    if (sessionResult.data.session?.user.id) {
      return sessionResult.data.session;
    }

    const anonymousResult = await supabase.auth.signInAnonymously();

    if (anonymousResult.error) {
      return null;
    }

    return anonymousResult.data.session ?? null;
  }

  // On mount: use an existing session if present, otherwise fall back to
  // anonymous auth for the fastest onboarding path. If neither works,
  // send the user to the explicit auth page.
  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const supabase = getSupabaseBrowserClient();
        const session = await ensureOnboardingSession();

        if (!session?.user.id) {
          router.replace("/auth?error=session_required");
          return;
        }

        const googleName = session.user.user_metadata?.full_name as
          | string
          | undefined;

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!active) return;

        if (data) {
          const profileRow = data as ProfileRow;
          const mapped = mapProfileRowToPersistedProfile(profileRow);
          setForm((current) => ({
            ...current,
            name: mapped.name,
            phone: mapped.phone,
            city: mapped.city,
            state_region: mapped.state_region,
            country: mapped.country,
            linkedin_url: mapped.linkedin_url,
            website_url: mapped.website_url,
            github_url: mapped.github_url,
            school: mapped.school,
            major: mapped.major,
            degree: mapped.degree,
            graduation: mapped.graduation,
            gpa: mapped.gpa,
            authorized_to_work: mapped.authorized_to_work,
            visa_type: mapped.visa_type,
            earliest_start_date: mapped.earliest_start_date,
            industries: mapped.industries,
            levels: mapped.levels,
            locations: mapped.locations,
            remote_ok: mapped.remote_ok,
            gray_areas: mapped.gray_areas,
            eeo: mapped.eeo,
            annotatedResume: extractResumeFromProfileRow(profileRow),
          }));
        } else if (googleName) {
          setForm((current) => ({ ...current, name: googleName }));
        }
      } catch (error) {
        if (!active) return;

        setAuthError(
          error instanceof Error
            ? `Unable to start onboarding: ${error.message}`
            : "Unable to start onboarding."
        );
      }
    }

    void bootstrap();
    return () => { active = false; };
  }, [router]);

  function update(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function goNext() {
    if (!canAdvance) return;

    if (!isLast) {
      setDirection(1);
      setStepIndex((i) => i + 1);
      return;
    }

    // Final step — save the profile
    setSaving(true);
    setAuthError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const session = await ensureOnboardingSession();

      if (!session?.user.id) {
        router.replace("/auth?error=session_required");
        return;
      }

      const { annotatedResume, ...profileFields } = form;
      const payload = mapProfileToUpsertInput({
        userId: session.user.id,
        userEmail: session.user.email ?? "",
        profile: profileFields,
        resume: annotatedResume,
      });

      const { error } = await supabase.from("profiles").upsert(payload);
      if (error) throw error;

      router.push("/dashboard");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Failed to save your profile."
      );
    } finally {
      setSaving(false);
    }
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
      <header className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
        <span className="text-lg font-semibold tracking-tight text-gray-900">
          Twin
        </span>
        <StepCircles steps={STEPS} currentIndex={stepIndex} />
      </header>

      <main className="flex-1 flex items-start justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-lg">
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
              {currentStep.id === "personal" && (
                <StepProfile
                  name={form.name}
                  phone={form.phone}
                  city={form.city}
                  state_region={form.state_region}
                  country={form.country}
                  linkedin_url={form.linkedin_url}
                  website_url={form.website_url}
                  github_url={form.github_url}
                  onChange={(patch) => update(patch)}
                />
              )}
              {currentStep.id === "education" && (
                <StepEducation
                  school={form.school}
                  major={form.major}
                  degree={form.degree}
                  gpa={form.gpa}
                  graduation={form.graduation}
                  authorized_to_work={form.authorized_to_work}
                  visa_type={form.visa_type}
                  earliest_start_date={form.earliest_start_date}
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
              {currentStep.id === "autofill" && (
                <StepAutofill
                  eeo={form.eeo}
                  onChange={(eeo) => update({ eeo })}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100">
            <Button variant="ghost" onClick={goBack} disabled={stepIndex === 0}>
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            <Button onClick={() => void goNext()} disabled={!canAdvance}>
              {isLast ? (saving ? "Saving..." : "Finish setup") : "Continue"}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
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
