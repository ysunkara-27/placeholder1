export type PortalKind =
  | "greenhouse"
  | "lever"
  | "workday"
  | "ashby"
  | "handshake"
  | "vision";

export type JobPortalKind =
  | "greenhouse"
  | "lever"
  | "workday"
  | "handshake"
  | "linkedin"
  | "indeed"
  | "icims"
  | "smartrecruiters"
  | "company_website"
  | "other";

export function detectPortalFromUrl(url: string): PortalKind {
  const normalized = url.toLowerCase();

  if (
    normalized.includes("greenhouse.io") ||
    normalized.includes("job-boards.greenhouse.io") ||
    normalized.includes("boards.greenhouse.io")
  ) {
    return "greenhouse";
  }

  if (normalized.includes("lever.co")) {
    return "lever";
  }

  if (
    normalized.includes("myworkdayjobs.com") ||
    normalized.includes("wd1.myworkday") ||
    normalized.includes("wd5.myworkday") ||
    normalized.includes("workday")
  ) {
    return "workday";
  }

  if (normalized.includes("ashbyhq.com")) {
    return "ashby";
  }

  if (
    normalized.includes("handshake.com") ||
    normalized.includes("joinhandshake.com")
  ) {
    return "handshake";
  }

  return "vision";
}

export function detectJobPortalFromUrl(url: string): JobPortalKind {
  const normalized = url.toLowerCase();
  const applyEnginePortal = detectPortalFromUrl(normalized);

  if (
    applyEnginePortal !== "vision" &&
    applyEnginePortal !== "ashby"
  ) {
    return applyEnginePortal;
  }

  if (applyEnginePortal === "ashby") {
    return "company_website";
  }

  if (normalized.includes("linkedin.com")) {
    return "linkedin";
  }

  if (normalized.includes("indeed.com")) {
    return "indeed";
  }

  if (normalized.includes("icims.com")) {
    return "icims";
  }

  if (normalized.includes("smartrecruiters.com")) {
    return "smartrecruiters";
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return "company_website";
  }

  return "other";
}
