"use client";

import type { ResumeProfile } from "@/lib/types";

interface Props {
  resume: Partial<ResumeProfile>;
}

export function ResumePreview({ resume }: Props) {
  const hasContent =
    resume.name ||
    (resume.experience && resume.experience.length > 0) ||
    (resume.education && resume.education.length > 0) ||
    (resume.skills && resume.skills.length > 0);

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Your resume will appear here</p>
          <p className="text-xs text-gray-400 mt-1">
            Start chatting or upload a PDF to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Resume document */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5 text-sm font-sans max-w-[680px] mx-auto">
        {/* Header */}
        {(resume.name || resume.email || resume.phone) && (
          <div className="text-center pb-4 border-b border-gray-200">
            {resume.name && (
              <h1 className="text-2xl font-bold text-gray-900">{resume.name}</h1>
            )}
            <div className="flex items-center justify-center gap-3 mt-1 text-gray-500 text-xs flex-wrap">
              {resume.email && <span>{resume.email}</span>}
              {resume.phone && (
                <>
                  <span className="text-gray-300">·</span>
                  <span>{resume.phone}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Education */}
        {resume.education && resume.education.length > 0 && (
          <section>
            <SectionHeader>Education</SectionHeader>
            <div className="space-y-3 mt-2">
              {resume.education.map((edu, i) => (
                <div key={i}>
                  <div className="flex justify-between items-baseline">
                    <p className="font-semibold text-gray-900">{edu.school}</p>
                    <p className="text-gray-400 text-xs shrink-0">{edu.graduation}</p>
                  </div>
                  <p className="text-gray-600">{edu.degree}</p>
                  {edu.gpa && (
                    <p className="text-gray-400 text-xs mt-0.5">GPA: {edu.gpa}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Experience */}
        {resume.experience && resume.experience.length > 0 && (
          <section>
            <SectionHeader>Experience</SectionHeader>
            <div className="space-y-4 mt-2">
              {resume.experience.map((exp, i) => (
                <div key={i}>
                  <div className="flex justify-between items-baseline">
                    <p className="font-semibold text-gray-900">{exp.title}</p>
                    <p className="text-gray-400 text-xs shrink-0">{exp.dates}</p>
                  </div>
                  <p className="text-gray-600">{exp.company}</p>
                  {exp.bullets.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {exp.bullets.map((bullet, j) => (
                        <li key={j} className="flex gap-2 text-gray-700">
                          <span className="text-gray-300 shrink-0 mt-0.5">–</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {exp.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {exp.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills */}
        {resume.skills && resume.skills.length > 0 && (
          <section>
            <SectionHeader>Skills</SectionHeader>
            <p className="text-gray-700 mt-2">{resume.skills.join(" · ")}</p>
          </section>
        )}

        {/* Excess pool indicator */}
        {resume.excess_pool && resume.excess_pool.length > 0 && (
          <section className="pt-3 border-t border-dashed border-gray-200">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
              Excess Pool ({resume.excess_pool.length} bullets — used for cover letters & ATS)
            </p>
            <ul className="space-y-1">
              {resume.excess_pool.map((b, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-400">
                  <span className="shrink-0">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 border-b border-indigo-100 pb-1">
      {children}
    </h2>
  );
}
