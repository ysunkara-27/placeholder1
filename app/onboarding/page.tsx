"use client";

import { useEffect, useRef, useState } from "react";
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
  JobRoleFamily,
  AnnotatedResume,
  EEOData,
  TargetTerm,
  DisclosurePolicy,
  WorkModality,
} from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  extractResumeFromProfileRow,
  mapProfileRowToPersistedProfile,
  mapProfileToResolvedUpsertInput,
  type ProfileRow,
} from "@/lib/platform/profile";
import { clampText, MAX_COVER_LETTER_CHARS } from "@/lib/upload-limits";
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
  major2: string;
  degree: string;
  gpa: string;
  graduation: string;
  authorized_to_work: boolean;
  visa_type: string;
  earliest_start_date: string;
  weekly_availability_hours: string;
  // Step 3: preferences
  industries: Industry[];
  levels: JobLevel[];
  target_role_families: JobRoleFamily[];
  target_terms: TargetTerm[];
  target_years: number[];
  locations: string[];
  remote_ok: boolean;
  work_modality_allow: WorkModality[];
  open_to_relocate: boolean;
  gray_areas: unknown;
  // Step 4: resume
  annotatedResume: AnnotatedResume | null;
  resumeUrl: string | null;
  cover_letter_template: string;
  // Step 5: autofill (optional)
  eeo: EEOData | null;
  graduation_year: number | null;
  graduation_term: TargetTerm | null;
  gpa_disclosure_policy: DisclosurePolicy;
  eeo_disclosure_policy: DisclosurePolicy;
}

const INITIAL: FormState = {
  name: "", phone: "", city: "", state_region: "", country: "United States",
  linkedin_url: "", website_url: "", github_url: "",
  school: "", major: "", major2: "", degree: "", gpa: "", graduation: "",
  authorized_to_work: true, visa_type: "", earliest_start_date: "", weekly_availability_hours: "",
  industries: [], levels: [], target_role_families: [], target_terms: [], target_years: [], locations: [], remote_ok: false, work_modality_allow: ["hybrid", "onsite"], open_to_relocate: false, gray_areas: null,
  annotatedResume: null,
  resumeUrl: null,
  cover_letter_template: "",
  eeo: null,
  graduation_year: null,
  graduation_term: null,
  gpa_disclosure_policy: "required_only",
  eeo_disclosure_policy: "required_only",
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
        form.work_modality_allow.length > 0 &&
        (form.locations.length > 0 || form.remote_ok)
      );
    case "resume":
      return form.annotatedResume !== null;
    case "autofill":
      return true; // all optional
    default:
      return true;
  }
}

function clampFormTextFields(form: Partial<FormState>): Partial<FormState> {
  return {
    ...form,
    ...(typeof form.cover_letter_template === "string"
      ? {
          cover_letter_template: clampText(
            form.cover_letter_template,
            MAX_COVER_LETTER_CHARS
          ),
        }
      : {}),
  };
}

function hasStepProgress(step: StepId, form: FormState): boolean {
  switch (step) {
    case "personal":
      return Boolean(
        form.name.trim() ||
        form.phone.trim() ||
        form.city.trim() ||
        form.state_region.trim() ||
        form.linkedin_url.trim() ||
        form.website_url.trim() ||
        form.github_url.trim()
      );
    case "education":
      return Boolean(
        form.school.trim() ||
        form.major.trim() ||
        form.major2.trim() ||
        form.degree.trim() ||
        form.gpa.trim() ||
        form.graduation.trim() ||
        form.visa_type.trim() ||
        form.earliest_start_date.trim() ||
        form.weekly_availability_hours.trim()
      );
    case "preferences":
      return Boolean(
        form.industries.length ||
        form.levels.length ||
        form.target_terms.length ||
        form.target_years.length ||
        form.locations.length ||
        form.remote_ok ||
        form.work_modality_allow.length ||
        form.open_to_relocate
      );
    case "resume":
      return Boolean(
        form.annotatedResume ||
        form.resumeUrl ||
        form.cover_letter_template.trim()
      );
    case "autofill":
      return Boolean(
        form.eeo ||
        form.graduation_year ||
        form.graduation_term ||
        form.gpa_disclosure_policy !== "required_only" ||
        form.eeo_disclosure_policy !== "required_only"
      );
    default:
      return false;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [maxVisitedStepIndex, setMaxVisitedStepIndex] = useState(0);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStep = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const canAdvance = !saving && isStepValid(currentStep.id, form);
  const unlockedStepIds = new Set(
    STEPS.filter((step, index) =>
      index <= maxVisitedStepIndex || hasStepProgress(step.id, form)
    ).map((step) => step.id)
  );

  // Save draft to localStorage on every form change (debounced)
  useEffect(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        localStorage.setItem("twin_onboarding_draft", JSON.stringify(form));
      } catch { /* storage full */ }
    }, 800);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [form]);

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

        setSessionUserId(session.user.id);

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
          if (profileRow.onboarding_completed) {
            router.replace("/profile");
            return;
          }
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
            target_role_families: mapped.target_role_families,
            target_terms: mapped.target_terms,
            target_years: mapped.target_years,
            locations: mapped.locations,
            remote_ok: mapped.remote_ok,
            work_modality_allow: mapped.work_modality_allow,
            open_to_relocate: mapped.open_to_relocate,
            gray_areas: mapped.gray_areas,
            eeo: mapped.eeo,
            annotatedResume: extractResumeFromProfileRow(profileRow),
            resumeUrl: mapped.resume_url,
            major2: mapped.major2,
            cover_letter_template: clampText(
              mapped.cover_letter_template,
              MAX_COVER_LETTER_CHARS
            ),
            weekly_availability_hours: (mapped as any).weekly_availability_hours ?? "",
            graduation_year: mapped.graduation_year,
            graduation_term: mapped.graduation_term,
            gpa_disclosure_policy: mapped.gpa_disclosure_policy,
            eeo_disclosure_policy: mapped.eeo_disclosure_policy,
          }));

          // Restore draft for fields not in Supabase yet
          try {
            const raw = localStorage.getItem("twin_onboarding_draft");
            if (raw) {
              const draft = JSON.parse(raw) as Partial<FormState>;
              setForm((current) => ({
                ...current,
                major2: current.major2 || draft.major2 || "",
                cover_letter_template:
                  current.cover_letter_template ||
                  clampText(draft.cover_letter_template || "", MAX_COVER_LETTER_CHARS),
                target_role_families:
                  current.target_role_families.length > 0
                    ? current.target_role_families
                    : draft.target_role_families || [],
                target_terms:
                  current.target_terms.length > 0
                    ? current.target_terms
                    : draft.target_terms || [],
                target_years:
                  current.target_years.length > 0
                    ? current.target_years
                    : draft.target_years || [],
                work_modality_allow:
                  current.work_modality_allow.length > 0
                    ? current.work_modality_allow
                    : ((draft.work_modality_allow as WorkModality[]) ?? ["hybrid", "onsite"]),
                open_to_relocate:
                  current.open_to_relocate || Boolean(draft.open_to_relocate),
                gpa_disclosure_policy:
                  current.gpa_disclosure_policy !== "required_only"
                    ? current.gpa_disclosure_policy
                    : ((draft.gpa_disclosure_policy as DisclosurePolicy) ?? "required_only"),
                eeo_disclosure_policy:
                  current.eeo_disclosure_policy !== "required_only"
                    ? current.eeo_disclosure_policy
                    : ((draft.eeo_disclosure_policy as DisclosurePolicy) ?? "required_only"),
              }));
            }
          } catch {/* ignore */}
        } else if (googleName) {
          setForm((current) => ({ ...current, name: googleName }));

          try {
            const raw = localStorage.getItem("twin_onboarding_draft");
            if (raw) {
              const draft = JSON.parse(raw) as Partial<FormState>;
              setForm((current) => ({
                ...current,
                ...clampFormTextFields(draft),
              }));
            }
          } catch {/* ignore */}
        }
      } catch (error) {
        if (!active) return;

        setAuthError(
          error instanceof Error
            ? `Unable to start onboarding: ${error.message}`
            : "Unable to start onboarding."
        );
      } finally {
        if (active) {
          setBootstrapping(false);
        }
      }
    }

    void bootstrap();
    return () => { active = false; };
  }, [router]);

  function update(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...clampFormTextFields(patch) }));
  }

  async function saveProfile() {
    setSaving(true);
    setAuthError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const session = await ensureOnboardingSession();

      if (!session?.user.id) {
        router.replace("/auth?error=session_required");
        return;
      }

      const { annotatedResume, resumeUrl: _resumeUrl, ...profileFields } = form;
      const payload = await mapProfileToResolvedUpsertInput({
        supabase,
        userId: session.user.id,
        userEmail: session.user.email ?? "",
        profile: {
          ...profileFields,
          resume_url: form.resumeUrl,
          major2: form.major2,
          cover_letter_template: form.cover_letter_template,
          weekly_availability_hours: form.weekly_availability_hours,
          target_role_families: form.target_role_families,
          target_terms: form.target_terms,
          target_years: form.target_years,
          graduation_year: form.graduation_year,
          graduation_term: form.graduation_term,
        } as any,
        resume: annotatedResume,
      });

      const { error } = await supabase.from("profiles").upsert(payload);
      if (error) throw error;

      localStorage.removeItem("twin_onboarding_draft");
      router.push("/dashboard");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Failed to save your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  async function goNext() {
    if (!canAdvance) return;

    if (!isLast) {
      setDirection(1);
      setStepIndex((i) => i + 1);
      return;
    }

    await saveProfile();
  }

  function goBack() {
    if (stepIndex === 0) return;
    setDirection(-1);
    setStepIndex((i) => i - 1);
  }

  function goToStep(nextIndex: number) {
    if (nextIndex === stepIndex) return;

    const nextStep = STEPS[nextIndex];
    if (!nextStep || !unlockedStepIds.has(nextStep.id)) {
      return;
    }

    setDirection(nextIndex > stepIndex ? 1 : -1);
    setStepIndex(nextIndex);
  }

  useEffect(() => {
    setMaxVisitedStepIndex((current) => Math.max(current, stepIndex));
  }, [stepIndex]);

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="h-8 w-8 rounded-full border-2 border-accent-wash border-t-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <main className="flex-1 flex items-start justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-3xl">
          <div className="rounded-[28px] border border-rim bg-white px-6 py-7 shadow-soft-card">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-dim">
                  Build your Twin
                </p>
                <h1 className="text-4xl leading-none text-ink">
                  Set up the profile once.
                </h1>
                <p className="max-w-xl text-sm leading-7 text-dim">
                  Save the details applications keep asking for, keep the flow calm, and finish
                  with a profile your Twin can actually execute with.
                </p>
              </div>
              <div className="hidden sm:block">
                <StepCircles
                  steps={STEPS}
                  currentIndex={stepIndex}
                  unlockedStepIds={unlockedStepIds}
                  onSelectStep={goToStep}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-rim bg-white p-7 shadow-soft-card">
          <div className="mb-8 flex justify-center sm:hidden">
            <StepCircles
              steps={STEPS}
              currentIndex={stepIndex}
              unlockedStepIds={unlockedStepIds}
              onSelectStep={goToStep}
            />
          </div>

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
                  major2={form.major2}
                  degree={form.degree}
                  gpa={form.gpa}
                  graduation={form.graduation}
                  authorized_to_work={form.authorized_to_work}
                  visa_type={form.visa_type}
                  earliest_start_date={form.earliest_start_date}
                  weekly_availability_hours={form.weekly_availability_hours}
                  onChange={(patch) => update(patch)}
                />
              )}
              {currentStep.id === "preferences" && (
                <StepPreferences
                  industries={form.industries}
                  levels={form.levels}
                  targetTerms={form.target_terms}
                  targetYears={form.target_years}
                  locations={form.locations}
                  remoteOk={form.remote_ok}
                  workModalityAllow={form.work_modality_allow}
                  openToRelocate={form.open_to_relocate}
                  onChange={(patch) => {
                    const full: Partial<FormState> = { ...patch as Partial<FormState> };
                    if ("levels" in patch && Array.isArray(patch.levels)) {
                      full.target_role_families = patch.levels as any;
                    }
                    if ("work_modality_allow" in patch && Array.isArray((patch as any).work_modality_allow)) {
                      full.remote_ok = (patch as any).work_modality_allow.includes("remote");
                    }
                    update(full);
                  }}
                />
              )}
              {currentStep.id === "resume" && (
                <StepResume
                  value={form.annotatedResume}
                  onChange={(annotatedResume) => update({ annotatedResume })}
                  onResumeUrl={(resumeUrl) => update({ resumeUrl })}
                  userId={sessionUserId ?? undefined}
                  coverLetter={form.cover_letter_template}
                  onCoverLetterChange={(cover_letter_template) => update({ cover_letter_template })}
                />
              )}
              {currentStep.id === "autofill" && (
                <StepAutofill
                  eeo={form.eeo}
                  gpaDisclosurePolicy={form.gpa_disclosure_policy}
                  eeoDisclosurePolicy={form.eeo_disclosure_policy}
                  onChange={(patch) => update(patch)}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-10 pt-6 border-t border-rim">
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
        </div>
      </main>
    </div>
  );
}

// ─── Step circle progress indicator ──────────────────────────────────────────

function StepCircles({
  steps,
  currentIndex,
  unlockedStepIds,
  onSelectStep,
}: {
  steps: typeof STEPS;
  currentIndex: number;
  unlockedStepIds: Set<StepId>;
  onSelectStep: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const unlocked = unlockedStepIds.has(step.id);
        return (
          <div key={step.id} className="flex items-center">
            <button
              type="button"
              onClick={() => onSelectStep(i)}
              disabled={!unlocked}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 ${
                done
                  ? "bg-accent text-white"
                  : active
                  ? "bg-accent text-white ring-4 ring-accent-wash"
                  : "bg-surface text-dim"
              } ${unlocked ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
              aria-label={`Step ${i + 1}: ${step.label}`}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </button>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-6 transition-colors duration-300 ${
                  done ? "bg-accent/50" : "bg-rim"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
