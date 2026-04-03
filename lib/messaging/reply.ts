export type ReplyAction = "stop" | "unknown";

const STOP_TOKENS = new Set([
  "stop", "unsubscribe", "cancel", "quit", "end", "stopall",
]);

export function normalizeReplyText(text: string): ReplyAction {
  const normalized = text.trim().toLowerCase().replace(/[.!,]+$/, "");

  if (STOP_TOKENS.has(normalized)) return "stop";

  return "unknown";
}

export function extractPhoneNumber(raw: string): string {
  // Strip all non-digit characters, then ensure E.164 +1 prefix for US
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Return as-is with + prefix if already has international format
  return raw.startsWith("+") ? raw : `+${digits}`;
}

export function parseFollowupReplyAnswers(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const numberedMatches = Array.from(
    normalized.matchAll(/(?:^|\n)\s*(\d+)[.)-]\s*([\s\S]*?)(?=(?:\n\s*\d+[.)-]\s*)|$)/g)
  );

  if (numberedMatches.length > 0) {
    return numberedMatches
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .map((match) => match[2].trim())
      .filter(Boolean);
  }

  const lineSplit = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lineSplit.length > 1) {
    return lineSplit;
  }

  return [normalized];
}
