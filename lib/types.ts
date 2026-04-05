// ─── Resume ──────────────────────────────────────────────────────────────────

export interface Education {
  school: string;
  degree: string;
  graduation: string;
  gpa?: string;
}

export interface Experience {
  company: string;
  title: string;
  dates: string;
  bullets: string[];
  tags: string[];
}

export type Industry =
  | "SWE"
  | "Finance"
  | "Consulting"
  | "PM"
  | "Research"
  | "Data"
  | "Design"
  | "Marketing"
  | "Legal"
  | "Healthcare"
  | "Operations"
  | "Sales";

export type JobLevel =
  | "internship"
  | "new_grad"
  | "part_time"
  | "co_op"
  | "associate";

export type JobRoleFamily =
  | "internship"
  | "co_op"
  | "new_grad"
  | "associate"
  | "part_time";

export type TargetTerm = string; // e.g. "2026 Summer", "2026 Fall", "Full Time"

export type ExperienceBand = "student" | "new_grad" | "early_career";


export type NotificationPref = "sms" | "email";

export interface UserPreferences {
  industries: Industry[];
  levels: JobLevel[];
  locations: string[];
  remote_ok: boolean;
  salary_min: number;
  salary_max: number;
  sponsorship_required: boolean;
  min_company_size: number | null;
  excluded_companies: string[];
  excluded_industries: string[];
  notification: NotificationPref;
  phone?: string;
  email: string;
}

export interface ResumeProfile {
  name: string;
  email: string;
  phone?: string;
  education: Education[];
  experience: Experience[];
  skills: string[];
  excess_pool: string[];
  preferences: UserPreferences;
}

// ─── Annotation (locked vs flexible resume sections) ─────────────────────────

export type LockState = "locked" | "flexible";

export interface AnnotatedBullet {
  id: string;
  text: string;
  lock: LockState;
}

export interface AnnotatedSkill {
  id: string;
  name: string;
  lock: LockState;
}

export interface AnnotatedExperience {
  id: string;
  company: string;
  title: string;
  dates: string;
  bullets: AnnotatedBullet[];
}

export interface AnnotatedResume {
  name: string;
  email: string;
  phone?: string;
  education: Education[]; // always locked — no toggle
  experience: AnnotatedExperience[];
  skills: AnnotatedSkill[];
  excess_pool: AnnotatedBullet[]; // always flexible — for ATS / cover letters
}

export interface PersonalInfo {
  name: string;
  email: string;
  school: string;
  degree: string;
  graduation: string;
  gpa: string;
}

// ─── Gray Areas (Claude-suggested) ───────────────────────────────────────────

export interface GrayAreaSuggestion {
  salary_min: number;
  salary_max: number;
  salary_unit: "hourly" | "annual";
  sponsorship_required: boolean;
  min_company_size: number | null;
  excluded_companies: string[];
  excluded_industries: string[];
  rationale: {
    salary: string;
    sponsorship: string;
    company_size: string;
  };
  follow_up_answers?: Record<string, string>;
  last_follow_up_response_at?: string;
}

// ─── Resume Chat ─────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
}

export interface ParsedResumeChunk {
  type: "experience" | "education" | "skill" | "bullet" | "summary";
  raw: string;
  structured?: Partial<Experience> | Partial<Education>;
}

// ─── Jobs (for later) ─────────────────────────────────────────────────────────

export interface Job {
  id: string;
  company: string;
  title: string;
  level: JobLevel;
  role_family?: JobRoleFamily | null;
  target_term?: TargetTerm | null;
  target_year?: number | null;
  experience_band?: ExperienceBand | null;
  location: string;
  remote: boolean;
  industries: string[];
  url: string;
  application_url: string;
  posted_at: string;
  jd_summary?: string;
  scraped_at: string;
}

export type AlertStatus =
  | "pending"
  | "sent"
  | "confirmed"
  | "skipped"
  | "expired"
  | "applied"
  | "failed";

export interface Alert {
  id: string;
  user_id: string;
  job_id: string;
  job: Job;
  status: AlertStatus;
  alerted_at: string;
  replied_at?: string;
}

// ─── EEO / Diversity data ─────────────────────────────────────────────────────

export interface EEOData {
  pronouns?: string;
  gender?: string;
  race_ethnicity?: string;
  veteran_status?: string;
  disability_status?: string;
  disability_type?: string;
  gpa_range?: string;
  sat_range?: string;
  act_range?: string;
}
