export type ProviderClipboardDraft = {
  name: string;
  baseUrl: string;
  apiKey: string;
};

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const API_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

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
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        continue;
      }

      const baseUrl = candidate.replace(/\/+$/, "");
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
