export function extractHostname(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed).hostname || "";
  } catch {
    return "";
  }
}

export function resolveProviderName(
  rawName: string,
  candidates: Array<string | undefined>,
): string {
  const trimmedName = rawName.trim();
  if (trimmedName) {
    return trimmedName;
  }

  for (const candidate of candidates) {
    const hostname = extractHostname(candidate ?? "");
    if (hostname) {
      return hostname;
    }
  }

  return "";
}
