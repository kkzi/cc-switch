export type ProviderClipboardDraft = {
  name: string;
  baseUrl: string;
  apiKey: string;
};

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const API_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const TRAILING_URL_PUNCTUATION = /[),.;:!?，。；：！？、]+$/;

export function extractProviderDraftFromClipboard(
  text: string,
): ProviderClipboardDraft | null {
  const source = text.trim();
  if (!source) {
    return null;
  }

  const matches = source.match(URL_PATTERN) ?? [];

  for (const candidate of matches) {
    try {
      const sanitizedCandidate = candidate.replace(TRAILING_URL_PUNCTUATION, "");
      const parsed = new URL(sanitizedCandidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        continue;
      }

      const baseUrl = sanitizedCandidate.replace(/\/+$/, "");
      const remainder = source.replace(candidate, " ");
      const apiKey =
        remainder
          .split(/\s+/)
          .find((token) => token.length > 0 && API_KEY_PATTERN.test(token)) ??
        "";

      return {
        name: parsed.hostname,
        baseUrl,
        apiKey,
      };
    } catch {
      continue;
    }
  }

  return null;
}
