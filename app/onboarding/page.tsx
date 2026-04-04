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
  GrayAreaSuggestion,
  AnnotatedResume,
  EEOData,
  TargetTerm,
} from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  extractResumeFromProfileRow,
  mapProfileRowToPersistedProfile,
  mapProfileToUpsertInput,
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
  gray_areas: GrayAreaSuggestion | null;
  // Step 4: resume
  annotatedResume: AnnotatedResume | null;
  resumeUrl: string | null;
  cover_letter_template: string;
  // Step 5: autofill (optional)
  eeo: EEOData | null;
  graduation_year: number | null;
  graduation_term: TargetTerm | null;
}

const INITIAL: FormState = {
  name: "", phone: "", city: "", state_region: "", country: "United States",
  linkedin_url: "", website_url: "", github_url: "",
  school: "", major: "", major2: "", degree: "", gpa: "", graduation: "",
  authorized_to_work: true, visa_type: "", earliest_start_date: "", weekly_availability_hours: "",
  industries: [], levels: [], target_role_families: [], target_terms: [], target_years: [], locations: [], remote_ok: false, gray_areas: null,
  annotatedResume: null,
  resumeUrl: null,
  cover_letter_template: "",
  eeo: null,
  graduation_year: null,
  graduation_term: null,
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
        form.target_role_families.length > 0 &&
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
        form.target_role_families.length ||
        form.target_terms.length ||
        form.target_years.length ||
        form.locations.length ||
        form.remote_ok ||
        form.gray_areas
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
        form.graduation_term
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
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isEditFooterVisible, setIsEditFooterVisible] = useState(false);
  const [maxVisitedStepIndex, setMaxVisitedStepIndex] = useState(0);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editFooterRef = useRef<HTMLDivElement | null>(null);

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
          setIsEditMode(Boolean(profileRow.onboarding_completed));
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
      const payload = mapProfileToUpsertInput({
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

  useEffect(() => {
    if (!isEditMode || !editFooterRef.current) {
      setIsEditFooterVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsEditFooterVisible(entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: "0px 0px -32px 0px",
      }
    );

    observer.observe(editFooterRef.current);
    return () => observer.disconnect();
  }, [isEditMode]);

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1 flex items-start justify-center px-6 py-12 overflow-y-auto">
        <div className={`w-full ${isEditMode ? "max-w-4xl" : "max-w-lg"}`}>
          {!isEditMode && (
            <div className="mb-8 flex justify-center">
              <StepCircles
                steps={STEPS}
                currentIndex={stepIndex}
                unlockedStepIds={unlockedStepIds}
                onSelectStep={goToStep}
              />
            </div>
          )}

          {authError && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {authError}
            </div>
          )}

          {isEditMode ? (
            <div className="space-y-8 pb-32">
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
                  Edit profile
                </h1>
                <p className="text-sm text-gray-500">
                  Update anything that changed. This edit view keeps your full profile on one page.
                </p>
              </div>

              <EditSection stepNumber={1} title="Personal" hint="Basics, links, and contact details">
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
              </EditSection>

              <EditSection stepNumber={2} title="Education" hint="School, authorization, and availability">
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
              </EditSection>

              <EditSection stepNumber={3} title="Preferences" hint="Targets, industries, and locations">
                <StepPreferences
                  industries={form.industries}
                  levels={form.levels}
                  targetRoleFamilies={form.target_role_families}
                  targetTerms={form.target_terms}
                  targetYears={form.target_years}
                  locations={form.locations}
                  remoteOk={form.remote_ok}
                  grayAreas={form.gray_areas}
                  onChange={(patch) => update(patch as Partial<FormState>)}
                />
              </EditSection>

              <EditSection stepNumber={4} title="Resume" hint="Resume parsing, locks, and cover letter">
                <StepResume
                  value={form.annotatedResume}
                  onChange={(annotatedResume) => update({ annotatedResume })}
                  onResumeUrl={(resumeUrl) => update({ resumeUrl })}
                  userId={sessionUserId ?? undefined}
                  coverLetter={form.cover_letter_template}
                  onCoverLetterChange={(cover_letter_template) => update({ cover_letter_template })}
                />
              </EditSection>

              <EditSection stepNumber={5} title="Autofill" hint="Optional EEO and extra application details">
                <StepAutofill
                  eeo={form.eeo}
                  onChange={(eeo) => update({ eeo })}
                />
              </EditSection>

              {!isEditFooterVisible && (
                <div className="fixed bottom-[11vh] left-1/2 z-40 -translate-x-1/2">
                  <div className="rounded-xl border border-white/35 bg-transparent p-2.5 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-sm">
                    <Button onClick={() => void saveProfile()} disabled={saving}>
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                  </div>
                </div>
              )}

              <div ref={editFooterRef} className="flex justify-center pt-6 pb-4">
                <div className="rounded-xl border border-white/35 bg-transparent p-2.5 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm">
                  <Button onClick={() => void saveProfile()} disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
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
                      targetRoleFamilies={form.target_role_families}
                      targetTerms={form.target_terms}
                      targetYears={form.target_years}
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
                      onResumeUrl={(resumeUrl) => update({ resumeUrl })}
                      userId={sessionUserId ?? undefined}
                      coverLetter={form.cover_letter_template}
                      onCoverLetterChange={(cover_letter_template) => update({ cover_letter_template })}
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
  unlockedStepIds,
  onSelectStep,
}: {
  steps: typeof STEPS;
  currentIndex: number;
  unlockedStepIds: Set<StepId>;
  onSelectStep: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
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
                  ? "bg-indigo-600 text-white"
                  : active
                  ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                  : "bg-gray-100 text-gray-400"
              } ${unlocked ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
              aria-label={`Step ${i + 1}: ${step.label}`}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </button>
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

function EditSection({
  stepNumber,
  title,
  hint,
  children,
}: {
  stepNumber: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
          {stepNumber}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
