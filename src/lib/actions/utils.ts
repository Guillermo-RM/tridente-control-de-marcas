import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { AuthContext } from "@/lib/auth/types";
import { writeAuditEvent } from "@/lib/security/audit";
import { getClientIp, getUserAgent } from "@/lib/security/request";

export function redirectWithError(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

export async function auditAction(
  context: AuthContext,
  event: {
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
) {
  const requestHeaders = await headers();
  await writeAuditEvent({
    organizationId: context.profile.organization_id,
    actorUserId: context.user.id,
    ...event,
    ip: getClientIp(requestHeaders),
    userAgent: getUserAgent(requestHeaders),
  });
}
