import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function formatPostedAt(isoString: string): string {
  const posted = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - posted.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export const INDUSTRY_OPTIONS = [
  // Tech & Digital
  { value: "SWE",         label: "Software Eng" },
  { value: "Data",        label: "Data & ML" },
  { value: "PM",          label: "Product" },
  { value: "Design",      label: "Design & UX" },
  { value: "Hardware",    label: "Hardware & Electrical" },
  // Engineering disciplines
  { value: "MechEng",     label: "Mechanical Eng" },
  { value: "CivilEng",    label: "Civil & Structural" },
  { value: "ChemEng",     label: "Chemical Eng" },
  { value: "AeroEng",     label: "Aerospace & Defense" },
  // Science & Health
  { value: "LifeSci",     label: "Life Sciences & Bio" },
  { value: "Research",    label: "Research & Science" },
  { value: "Healthcare",  label: "Healthcare & Clinical" },
  // Business
  { value: "Finance",     label: "Finance & Accounting" },
  { value: "Consulting",  label: "Consulting & Strategy" },
  { value: "Marketing",   label: "Marketing & Growth" },
  { value: "Operations",  label: "Operations & Supply Chain" },
  { value: "Sales",       label: "Sales & Biz Dev" },
  // Other
  { value: "Policy",      label: "Legal, Policy & Gov" },
  { value: "Education",   label: "Education & Nonprofit" },
] as const;

export const LEVEL_OPTIONS = [
  { value: "internship", label: "Internship", description: "Summer / semester internships" },
  { value: "new_grad", label: "New Grad", description: "Full-time roles for new graduates" },
  { value: "co_op", label: "Co-op", description: "Multi-term cooperative programs" },
  { value: "associate", label: "Associate", description: "Early-career full-time roles beyond new grad" },
  { value: "part_time", label: "Part-time", description: "Part-time roles during school" },
] as const;

export const TARGET_TERM_OPTIONS = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter", label: "Winter" },
  { value: "any", label: "Any term" },
] as const;

export const POPULAR_CITIES = [
  "New York",
  "San Francisco",
  "Seattle",
  "Austin",
  "Boston",
  "Chicago",
  "Los Angeles",
  "Washington DC",
  "Denver",
  "Miami",
] as const;
