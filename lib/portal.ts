export type PortalKind =
  | "greenhouse"
  | "lever"
  | "workday"
  | "handshake"
  | "vision";

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

  if (
    normalized.includes("handshake.com") ||
    normalized.includes("joinhandshake.com")
  ) {
    return "handshake";
  }

  return "vision";
}
