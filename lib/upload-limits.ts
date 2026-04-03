export const MAX_RESUME_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_RESUME_TEXT_CHARS = 20_000;
export const MAX_COVER_LETTER_CHARS = 4_000;

export function formatLimitBytes(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

export function clampText(value: string, maxChars: number) {
  return value.slice(0, maxChars);
}

export function isNearCharacterLimit(length: number, maxChars: number) {
  return length >= Math.floor(maxChars * 0.9);
}
