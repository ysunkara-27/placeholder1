"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StepProfile } from "@/components/onboarding/step-profile";
import { StepEducation } from "@/components/onboarding/step-education";
import { StepPreferences } from "@/components/onboarding/step-preferences";
import { StepAutofill } from "@/components/onboarding/step-autofill";
import { PortalAccountsCard } from "@/components/dashboard/portal-accounts-card";
import type {
  Industry,
  JobLevel,
  JobRoleFamily,
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
import { clampText, MAX_COVER_LETTER_CHARS, isNearCharacterLimit } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";
import { FileText, Loader2, CheckCircle2 } from "lucide-react";

// ─── Section definitions ─────────────────────────────────────────────────────

const SECTIONS = [
  { id: "personal",  title: "Personal",         hint: "Basics & contact" },
  { id: "education", title: "Education",        hint: "School & auth" },
  { id: "prefs",     title: "Preferences",      hint: "What you want" },
  { id: "resume",    title: "Resume",           hint: "PDF & cover letter" },
  { id: "autofill",  title: "Autofill",         hint: "EEO & scores" },
  { id: "portals",   title: "Portal accounts",  hint: "Auto-login" },
] as const;

// ─── Form state ───────────────────────────────────────────────────────────────

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
  // gray_areas preserved in DB but not displayed
  gray_areas: unknown;
  annotatedResume: AnnotatedResume | null;
  resumeUrl: string | null;
  cover_letter_template: string;
  eeo: EEOData | null;
  graduation_year: number | null;
  graduation_term: TargetTerm | null;
}

const INITIAL: FormState = {
  name: "", phone: "", city: "", state_region: "", country: "United States",
  linkedin_url: "", website_url: "", github_url: "",
  school: "", major: "", major2: "", degree: "", gpa: "", graduation: "",
  authorized_to_work: true, visa_type: "", earliest_start_date: "", weekly_availability_hours: "",
  industries: [], levels: [], target_role_families: [], target_terms: [], target_years: [],
  locations: [], remote_ok: false, gray_areas: null,
  annotatedResume: null, resumeUrl: null, cover_letter_template: "",
  eeo: null, graduation_year: null, graduation_term: null,
};

function clampFormTextFields(form: Partial<FormState>): Partial<FormState> {
  return {
    ...form,
    ...(typeof form.cover_letter_template === "string"
      ? { cover_letter_template: clampText(form.cover_letter_template, MAX_COVER_LETTER_CHARS) }
      : {}),
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [isEditFooterVisible, setIsEditFooterVisible] = useState(false);

  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const editFooterRef = useRef<HTMLDivElement | null>(null);

  // Bootstrap profile
  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user.id) { router.replace("/auth?error=session_required"); return; }

        setSessionUserId(session.user.id);
        setUserEmail(session.user.email ?? "");

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) throw error;
        if (!active) return;

        if (!data?.onboarding_completed) { router.replace("/onboarding"); return; }

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
          cover_letter_template: clampText(mapped.cover_letter_template, MAX_COVER_LETTER_CHARS),
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
        if (active) setBootstrapping(false);
      }
    }

    void bootstrap();
    return () => { active = false; };
  }, [router]);

  // Active section tracking via scroll
  useEffect(() => {
    if (bootstrapping) return;

    function handleScroll() {
      const refs = sectionRefs.current;
      let best = 0;
      for (let i = refs.length - 1; i >= 0; i--) {
        const el = refs[i];
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= 120) { best = i; break; }
      }
      setActiveSection(best);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [bootstrapping]);

  // Edit footer visibility
  useEffect(() => {
    if (!editFooterRef.current) { setIsEditFooterVisible(false); return; }
    const observer = new IntersectionObserver(
      ([entry]) => setIsEditFooterVisible(entry.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px -32px 0px" }
    );
    observer.observe(editFooterRef.current);
    return () => observer.disconnect();
  }, []);

  function update(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...clampFormTextFields(patch) }));
  }

  function scrollToSection(idx: number) {
    sectionRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveProfile() {
    setSaving(true);
    setAuthError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user.id) { router.replace("/auth?error=session_required"); return; }

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
      setAuthError(error instanceof Error ? error.message : "Failed to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="h-8 w-8 rounded-full border-2 border-accent-wash border-t-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <main className="flex-1 flex items-start justify-center px-4 py-12 overflow-y-auto">
        <div className="w-full max-w-5xl flex gap-10">

          {/* ── Sticky sidebar ─────────────────────────────────────────── */}
          <aside className="hidden lg:block w-44 shrink-0">
            <div className="sticky top-8">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-dim">
                Edit profile
              </p>
              <nav className="space-y-0.5">
                {SECTIONS.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => scrollToSection(i)}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150",
                      activeSection === i
                        ? "bg-accent-wash text-accent"
                        : "text-dim hover:bg-surface hover:text-ink"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                        activeSection === i
                          ? "bg-accent text-white"
                          : "bg-surface text-dim"
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="text-xs font-medium leading-tight">
                      {s.title}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* ── Content ───────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-8 pb-32">
            {authError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {authError}
              </div>
            )}

            <div className="space-y-1">
              <h1 className="text-4xl leading-none text-ink">
                Edit profile
              </h1>
              <p className="text-sm text-dim">
                Update anything that changed.
              </p>
            </div>

            {/* Profile completeness */}
            <ProfileCompleteness form={form} userEmail={userEmail} />

            {/* 1 · Personal */}
            <EditSection
              sectionRef={(el) => { sectionRefs.current[0] = el; }}
              stepNumber={1}
              title="Personal"
              hint="Basics, links, and contact details"
            >
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

            {/* 2 · Education */}
            <EditSection
              sectionRef={(el) => { sectionRefs.current[1] = el; }}
              stepNumber={2}
              title="Education"
              hint="School, authorization, and availability"
            >
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

            {/* 3 · Preferences */}
            <EditSection
              sectionRef={(el) => { sectionRefs.current[2] = el; }}
              stepNumber={3}
              title="Preferences"
              hint="Industries, role type, timing, and locations"
            >
              <StepPreferences
                industries={form.industries}
                levels={form.levels}
                targetTerms={form.target_terms}
                targetYears={form.target_years}
                locations={form.locations}
                remoteOk={form.remote_ok}
                onChange={(patch) => {
                  const full: Partial<FormState> = { ...patch as Partial<FormState> };
                  if ("levels" in patch && Array.isArray(patch.levels)) {
                    full.target_role_families = patch.levels as any;
                  }
                  update(full);
                }}
              />
            </EditSection>

            {/* 4 · Resume */}
            <EditSection
              sectionRef={(el) => { sectionRefs.current[3] = el; }}
              stepNumber={4}
              title="Resume"
              hint="PDF file and cover letter template"
            >
              <ProfileResumeSection
                resumeUrl={form.resumeUrl}
                onResumeUrl={(resumeUrl) => update({ resumeUrl })}
                userId={sessionUserId}
                coverLetter={form.cover_letter_template}
                onCoverLetterChange={(cover_letter_template) =>
                  update({ cover_letter_template })
                }
              />
            </EditSection>

            {/* 5 · Autofill */}
            <EditSection
              sectionRef={(el) => { sectionRefs.current[4] = el; }}
              stepNumber={5}
              title="Autofill"
              hint="EEO details and academic score ranges"
            >
              <StepAutofill
                eeo={form.eeo}
                onChange={(eeo) => update({ eeo })}
              />
            </EditSection>

            {/* 6 · Portal accounts */}
            <EditSection
              sectionRef={(el) => { sectionRefs.current[5] = el; }}
              stepNumber={6}
              title="Portal accounts"
              hint="Login credentials for Workday, iCIMS, Handshake, and more"
            >
              <PortalAccountsCard />
            </EditSection>

            {/* Footer save */}
            {!isEditFooterVisible && (
              <div className="fixed bottom-[11vh] left-1/2 z-40 -translate-x-1/2">
                <div className="rounded-xl border border-white/35 bg-transparent p-2.5 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-sm">
                  <Button onClick={() => void saveProfile()} disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            )}

            <div ref={editFooterRef} className="flex justify-end">
              <Button onClick={() => void saveProfile()} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── EditSection wrapper ──────────────────────────────────────────────────────

function EditSection({
  stepNumber,
  title,
  hint,
  children,
  sectionRef,
}: {
  stepNumber: number;
  title: string;
  hint: string;
  children: React.ReactNode;
  sectionRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <section
      ref={sectionRef}
      className="scroll-mt-8 rounded-[28px] border border-rim bg-white p-6 shadow-soft-card"
    >
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
          {stepNumber}
        </div>
        <div>
          <h2 className="text-2xl leading-none text-ink">{title}</h2>
          <p className="mt-1 text-sm text-dim">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// ─── Simplified resume section (PDF only) ────────────────────────────────────

function ProfileResumeSection({
  resumeUrl,
  onResumeUrl,
  userId,
  coverLetter,
  onCoverLetterChange,
}: {
  resumeUrl: string | null;
  onResumeUrl: (url: string) => void;
  userId: string | null;
  coverLetter: string;
  onCoverLetterChange: (v: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverLetterLength = coverLetter.length;
  const nearLimit = isNearCharacterLimit(coverLetterLength, MAX_COVER_LETTER_CHARS);

  async function handleFile(file: File) {
    if (!userId) return;
    if (file.type !== "application/pdf") {
      setUploadError("Please upload a PDF file.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);
      const res = await fetch("/api/resume/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Upload failed");
      if (data.resumeUrl) {
        onResumeUrl(data.resumeUrl);
        setUploadedName(file.name);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* PDF upload */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-ink">Resume (PDF)</p>
          <p className="text-xs text-dim mt-0.5">
            One file, used across all applications.
          </p>
        </div>

        {resumeUrl ? (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800">
                {uploadedName ?? "Resume uploaded"}
              </p>
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-700 underline underline-offset-2 hover:text-green-900"
              >
                View current resume
              </a>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 text-xs font-medium text-green-700 hover:text-green-900 underline underline-offset-2"
            >
              Replace
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !userId}
            className={cn(
              "flex items-center gap-3 w-full rounded-xl border-2 border-dashed px-4 py-6 text-left transition-colors duration-150",
              uploading
                ? "border-accent/20 bg-accent-wash cursor-wait"
                : "border-rim bg-white hover:border-accent/30 hover:bg-surface cursor-pointer shadow-soft-card"
            )}
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
            ) : (
              <FileText className="w-5 h-5 text-accent" />
            )}
            <div>
              <p className="text-sm font-medium text-ink">
                {uploading ? "Uploading…" : "Click to upload PDF"}
              </p>
              <p className="text-xs text-dim">PDF only</p>
            </div>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />

        {uploadError && (
          <p className="text-xs text-red-600">{uploadError}</p>
        )}
      </div>

      {/* Cover letter */}
      <div className="space-y-3 border-t border-rim pt-6">
        <div>
          <label className="text-sm font-medium text-ink">
            Cover letter template{" "}
            <span className="text-dim font-normal">(optional)</span>
          </label>
          <p className="text-xs text-dim mt-0.5">
            Your Twin will use this as a base and tailor it for each
            application. Leave blank to skip cover letters. Max{" "}
            {MAX_COVER_LETTER_CHARS.toLocaleString()} characters.
          </p>
        </div>
        <textarea
          value={coverLetter}
          onChange={(e) => onCoverLetterChange(e.target.value)}
          placeholder={"Dear Hiring Manager,\n\nI'm excited to apply for..."}
          rows={6}
          maxLength={MAX_COVER_LETTER_CHARS}
          className="w-full rounded-xl border border-rim bg-white px-4 py-3 text-sm text-ink placeholder:text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 resize-none transition-colors duration-150 shadow-soft-card"
        />
        <div className="flex justify-end">
          <p
            className={`text-xs ${nearLimit ? "text-amber-600" : "text-dim"}`}
          >
            {coverLetterLength.toLocaleString()} /{" "}
            {MAX_COVER_LETTER_CHARS.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Profile completeness ─────────────────────────────────────────────────────

function ProfileCompleteness({ form, userEmail }: { form: FormState; userEmail: string }) {
  const fields: Array<{ label: string; filled: boolean; reason: string }> = [
    { label: "Email", filled: !!userEmail, reason: "Required on every application form" },
    { label: "Phone", filled: !!form.phone, reason: "SMS alerts + required on many portals" },
    { label: "LinkedIn URL", filled: !!form.linkedin_url, reason: "Some portals make this required" },
    { label: "Resume PDF", filled: !!form.resumeUrl, reason: "No resume file = application blocked immediately" },
    { label: "Cover letter", filled: !!form.cover_letter_template, reason: "Portals that require a cover letter will skip it otherwise" },
    { label: "School", filled: !!form.school, reason: "Greenhouse and Workday pull this for the education section" },
    { label: "Graduation date", filled: !!form.graduation, reason: "90% of ATS forms ask for this" },
    { label: "Start date", filled: !!form.earliest_start_date, reason: "'When can you start?' is asked on every form" },
    { label: "Work authorization", filled: !!form.visa_type, reason: "ITAR and export control questions need this" },
    { label: "EEO data", filled: !!(form.eeo?.gender), reason: "Pre-fills diversity sections on most portals" },
  ];

  const filledCount = fields.filter((f) => f.filled).length;
  const pct = Math.round((filledCount / fields.length) * 100);

  return (
    <div className="rounded-[28px] border border-rim bg-white p-5 shadow-soft-card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Profile completeness</p>
          <p className="mt-0.5 text-xs text-dim">
            {filledCount === fields.length
              ? "All fields filled — Twin can handle the full application range."
              : `${filledCount} of ${fields.length} fields filled. Missing fields cause blocked applications.`}
          </p>
        </div>
        <span className={`text-sm font-bold tabular-nums ${pct === 100 ? "text-green-600" : pct >= 70 ? "text-accent" : "text-red-500"}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-green-500" : pct >= 70 ? "bg-accent" : "bg-red-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {fields.map((field) => (
          <div
            key={field.label}
            className={`flex items-start gap-1.5 rounded-lg px-2.5 py-2 ${field.filled ? "bg-surface" : "bg-red-50 border border-red-100"}`}
          >
            <span className={`mt-0.5 text-xs shrink-0 ${field.filled ? "text-green-500" : "text-red-400"}`}>
              {field.filled ? "✓" : "✗"}
            </span>
            <div className="min-w-0">
              <p className={`text-xs font-medium truncate ${field.filled ? "text-ink" : "text-red-700"}`}>
                {field.label}
              </p>
              {!field.filled && (
                <p className="text-[10px] text-red-500 mt-0.5 leading-tight">{field.reason}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
