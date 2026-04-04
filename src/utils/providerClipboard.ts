export type ProviderClipboardDraft = {
  name: string;
  baseUrl: string;
  apiKey: string;
};

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const API_KEY_PATTERN = /[A-Za-z0-9_-]+/g;
const STRUCTURED_API_KEY_PATTERNS = [
  /OPENAI_API_KEY["'“”]?\s*[:=：]\s*["'“”]?(sk-[A-Za-z0-9_-]+)["'“”]?/i,
  /API_KEY["'“”]?\s*[:=：]\s*["'“”]?(sk-[A-Za-z0-9_-]+)["'“”]?/i,
  /KEY["'“”]?\s*[:=：]\s*["'“”]?(sk-[A-Za-z0-9_-]+)["'“”]?/i,
] as const;
const TRAILING_URL_PUNCTUATION = /[),.;:!?，。；：！？、]+$/;

function extractApiKeyCandidate(text: string): string {
  for (const pattern of STRUCTURED_API_KEY_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  const candidates = text.match(API_KEY_PATTERN) ?? [];
  if (candidates.length === 0) {
    return "";
  }

  const likelyCandidate = candidates.find(
    (candidate) =>
      candidate.startsWith("sk-") ||
      (candidate.length >= 8 && /[-_\d]/.test(candidate)),
  );

  return likelyCandidate ?? candidates[0] ?? "";
}

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
      const apiKey = extractApiKeyCandidate(remainder);

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
