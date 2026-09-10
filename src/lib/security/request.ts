export function getClientIp(headers: Headers) {
  const forwarded =
    headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim() ?? headers.get("x-real-ip");

  return candidate?.slice(0, 64) || "unknown";
}

export function getUserAgent(headers: Headers) {
  return headers.get("user-agent")?.slice(0, 512) ?? null;
}
