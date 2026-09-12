export function getClientIp(headers: Headers) {
  const forwarded =
    headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim() ?? headers.get("x-real-ip");

  return candidate?.slice(0, 64) || "unknown";
}

export function getUserAgent(headers: Headers) {
  return headers.get("user-agent")?.slice(0, 512) ?? null;
}

export function hasSameOrigin(headers: Headers) {
  const origin = headers.get("origin");
  if (!origin) return true;

  const forwardedHost = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!forwardedHost) return false;

  try {
    return new URL(origin).host.toLowerCase() === forwardedHost.split(",")[0].trim().toLowerCase();
  } catch {
    return false;
  }
}
