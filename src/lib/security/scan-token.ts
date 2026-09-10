export function extractScanToken(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("tc1.")) return trimmed;

  try {
    const url = new URL(trimmed);
    return url.searchParams.get("token");
  } catch {
    return null;
  }
}
