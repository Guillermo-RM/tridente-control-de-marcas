import { createHmac, timingSafeEqual } from "node:crypto";
import { uuidSchema } from "@/lib/domain/schemas";
import { getServerEnv } from "@/lib/env";

function signature(payload: string) {
  return createHmac("sha256", getServerEnv().RATE_LIMIT_HASH_SECRET)
    .update(`tridente:incident-share:${payload}`).digest();
}

export function signIncidentShare(id: string, organizationId: string) {
  const payload = `v2.${id}.${organizationId}`;
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function verifyIncidentShare(token: string, now = Date.now()) {
  if (token.length > 140) return null;
  const parts = token.split(".");
  const mac = parts.pop() ?? "";
  const [version, id, organizationId, expires] = parts;
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(organizationId).success ||
    !/^[A-Za-z0-9_-]{43}$/.test(mac)) return null;

  if (version === "v1") {
    if (parts.length !== 4 || !/^\d{10}$/.test(expires) || Number(expires) <= Math.floor(now / 1000)) return null;
  } else if (version !== "v2" || parts.length !== 3) {
    return null;
  }

  const provided = Buffer.from(mac, "base64url");
  if (provided.toString("base64url") !== mac ||
    !timingSafeEqual(provided, signature(parts.join(".")))) return null;
  return { id, organizationId };
}
