"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StepProfile } from "@/components/onboarding/step-profile";
import { StepEducation } from "@/components/onboarding/step-education";
import { StepPreferences } from "@/components/onboarding/step-preferences";
import { StepResume } from "@/components/onboarding/step-resume";
import { StepAutofill } from "@/components/onboarding/step-autofill";
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

interface FormState {
  name: string;
  phone: string;
  city: string;
  state_region: string;
  country: string;
  linkedin_url: string;
  website_url: string;
  github_url: string;
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
  industries: Industry[];
  levels: JobLevel[];
  target_role_families: JobRoleFamily[];
  target_terms: TargetTerm[];
  target_years: number[];
  locations: string[];
  remote_ok: boolean;
  gray_areas: GrayAreaSuggestion | null;
  annotatedResume: AnnotatedResume | null;
  resumeUrl: string | null;
  cover_letter_template: string;
  eeo: EEOData | null;
  graduation_year: number | null;
  graduation_term: TargetTerm | null;
}

const INITIAL: FormState = {
  name: "",
  phone: "",
  city: "",
  state_region: "",
  country: "United States",
  linkedin_url: "",
  website_url: "",
  github_url: "",
  school: "",
  major: "",
  major2: "",
  degree: "",
  gpa: "",
  graduation: "",
  authorized_to_work: true,
  visa_type: "",
  earliest_start_date: "",
  weekly_availability_hours: "",
  industries: [],
  levels: [],
  target_role_families: [],
  target_terms: [],
  target_years: [],
  locations: [],
  remote_ok: false,
  gray_areas: null,
  annotatedResume: null,
  resumeUrl: null,
  cover_letter_template: "",
  eeo: null,
  graduation_year: null,
  graduation_term: null,
};

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

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isEditFooterVisible, setIsEditFooterVisible] = useState(false);
  const editFooterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session?.user.id) {
          router.replace("/auth?error=session_required");
          return;
        }

        setSessionUserId(session.user.id);

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!active) return;

        if (!data?.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }

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
        } catch {}
      } catch (error) {
        if (!active) return;

        setAuthError(
          error instanceof Error
            ? `Unable to load your profile: ${error.message}`
            : "Unable to load your profile."
        );
      } finally {
        if (active) {
          setBootstrapping(false);
        }
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!editFooterRef.current) {
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
  }, []);

  function update(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...clampFormTextFields(patch) }));
  }

  async function saveProfile() {
    setSaving(true);
    setAuthError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

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

  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1 flex items-start justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-4xl space-y-8 pb-32">
          {authError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {authError}
            </div>
          )}

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

          <div ref={editFooterRef} className="h-8" aria-hidden="true" />
        </div>
      </main>
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
