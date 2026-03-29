"use client";

import { useState } from "react";
import { AnnotatedBullet } from "@/components/resume/annotated-bullet";
import { AnnotatedSkillGrid } from "@/components/resume/annotated-skill";
import { LockToggle } from "@/components/resume/lock-toggle";
import { generateId, cn } from "@/lib/utils";
import type {
  AnnotatedResume,
  AnnotatedBullet as AnnotatedBulletType,
  AnnotatedExperience,
  AnnotatedSkill,
  LockState,
} from "@/lib/types";
import { ChevronDown, ChevronUp, Lock, Plus } from "lucide-react";

interface Props {
  resume: AnnotatedResume;
  onChange: (resume: AnnotatedResume) => void;
}

export function ResumeAnnotator({ resume, onChange }: Props) {
  // Track which experience entries are collapsed
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // ── Helpers ──────────────────────────────────────────────────────────────

  function updateExperience(id: string, patch: Partial<AnnotatedExperience>) {
    onChange({
      ...resume,
      experience: resume.experience.map((e) =>
        e.id === id ? { ...e, ...patch } : e
      ),
    });
  }

  function updateBullet(
    expId: string,
    bulletId: string,
    patch: Partial<Omit<AnnotatedBulletType, "id">>
  ) {
    updateExperience(expId, {
      bullets: resume.experience
        .find((e) => e.id === expId)!
        .bullets.map((b) => (b.id === bulletId ? { ...b, ...patch } : b)),
    });
  }

  function deleteBullet(expId: string, bulletId: string) {
    const exp = resume.experience.find((e) => e.id === expId)!;
    updateExperience(expId, {
      bullets: exp.bullets.filter((b) => b.id !== bulletId),
    });
  }

  function addBullet(expId: string) {
    const exp = resume.experience.find((e) => e.id === expId)!;
    updateExperience(expId, {
      bullets: [
        ...exp.bullets,
        { id: generateId(), text: "", lock: "flexible" },
      ],
    });
  }

  function updateSkills(skills: AnnotatedSkill[]) {
    onChange({ ...resume, skills });
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────

  function setAllBullets(lock: LockState) {
    onChange({
      ...resume,
      experience: resume.experience.map((e) => ({
        ...e,
        bullets: e.bullets.map((b) => ({ ...b, lock })),
      })),
    });
  }

  function resetToDefaults() {
    onChange({
      ...resume,
      experience: resume.experience.map((e) => ({
        ...e,
        bullets: e.bullets.map((b) => ({ ...b, lock: "flexible" })),
      })),
      skills: resume.skills.map((s) => ({ ...s, lock: "flexible" })),
    });
  }

  function setExperienceBulks(expId: string, lock: LockState) {
    const exp = resume.experience.find((e) => e.id === expId)!;
    updateExperience(expId, {
      bullets: exp.bullets.map((b) => ({ ...b, lock })),
    });
  }

  const totalBullets = resume.experience.reduce(
    (n, e) => n + e.bullets.length,
    0
  );
  const lockedBullets = resume.experience.reduce(
    (n, e) => n + e.bullets.filter((b) => b.lock === "locked").length,
    0
  );

  return (
    <div className="space-y-5">
      {/* Explainer callout */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-medium text-gray-800">
              Locked — stays word-for-word in every application
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-500 shrink-0">✦</span>
            <span className="font-medium text-gray-800">
              Flexible — gets tailored to each job&apos;s keywords automatically
            </span>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 mr-1">
          {lockedBullets}/{totalBullets} bullets locked
        </span>
        <button
          onClick={() => setAllBullets("locked")}
          className="text-xs rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
        >
          Lock all
        </button>
        <button
          onClick={() => setAllBullets("flexible")}
          className="text-xs rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-gray-600 hover:border-amber-300 hover:text-amber-600 transition-colors"
        >
          Make all flexible
        </button>
        <button
          onClick={resetToDefaults}
          className="text-xs rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-gray-400 hover:text-gray-600 transition-colors"
        >
          Reset defaults
        </button>
      </div>

      {/* Contact info (always locked) */}
      {(resume.name || resume.email) && (
        <LockedSection label="Contact info">
          <p className="text-sm text-gray-700">
            {[resume.name, resume.email, resume.phone]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </LockedSection>
      )}

      {/* Education (always locked) */}
      {resume.education.length > 0 && (
        <LockedSection label="Education">
          <div className="space-y-2">
            {resume.education.map((edu, i) => (
              <div key={i} className="text-sm text-gray-700">
                <span className="font-medium">{edu.school}</span>
                {edu.degree && ` · ${edu.degree}`}
                {edu.graduation && ` · ${edu.graduation}`}
                {edu.gpa && (
                  <span className="text-gray-400"> · GPA {edu.gpa}</span>
                )}
              </div>
            ))}
          </div>
        </LockedSection>
      )}

      {/* Experience entries */}
      {resume.experience.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Experience
          </h3>
          {resume.experience.map((exp) => {
            const isCollapsed = collapsed.has(exp.id);
            return (
              <div
                key={exp.id}
                className="rounded-xl border border-gray-200 bg-white overflow-hidden"
              >
                {/* Experience header — always locked */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-gray-900 truncate">
                        {exp.title}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-500 shrink-0">
                        <Lock className="w-2.5 h-2.5" />
                        Always locked
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {exp.company}
                      {exp.dates && (
                        <span className="text-gray-400"> · {exp.dates}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isCollapsed && (
                      <button
                        onClick={() =>
                          setExperienceBulks(
                            exp.id,
                            exp.bullets.every((b) => b.lock === "locked")
                              ? "flexible"
                              : "locked"
                          )
                        }
                        className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {exp.bullets.every((b) => b.lock === "locked")
                          ? "Unlock all"
                          : "Lock all"}
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setCollapsed((s) => {
                          const next = new Set(s);
                          isCollapsed ? next.delete(exp.id) : next.add(exp.id);
                          return next;
                        })
                      }
                      className="text-gray-300 hover:text-gray-500 transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronUp className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bullets */}
                {!isCollapsed && (
                  <div className="p-3 space-y-2">
                    {exp.bullets.map((bullet) => (
                      <AnnotatedBullet
                        key={bullet.id}
                        bullet={bullet}
                        onUpdate={(id, patch) =>
                          updateBullet(exp.id, id, patch)
                        }
                        onDelete={(id) => deleteBullet(exp.id, id)}
                      />
                    ))}
                    <button
                      onClick={() => addBullet(exp.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors w-full"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add bullet
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Skills */}
      {resume.skills.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Skills
            </h3>
            <span className="text-[11px] text-gray-400">
              Click any skill to toggle
            </span>
          </div>
          <AnnotatedSkillGrid skills={resume.skills} onChange={updateSkills} />
        </div>
      )}

      {/* Excess pool */}
      {resume.excess_pool.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500">
              Overflow pool
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Won&apos;t appear on your 1-page resume — used for ATS keyword
              injection and cover letters.
            </p>
          </div>
          <div className="space-y-2">
            {resume.excess_pool.map((bullet) => (
              <div
                key={bullet.id}
                className="flex gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5"
              >
                <span className="text-amber-400 shrink-0 mt-0.5 text-xs">✦</span>
                <p className="text-sm text-amber-800">{bullet.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Locked section wrapper ────────────────────────────────────────────────────

function LockedSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          {label}
        </h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-500">
          <Lock className="w-2.5 h-2.5" />
          Always locked
        </span>
      </div>
      {children}
    </div>
  );
}
