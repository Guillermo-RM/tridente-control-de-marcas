"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/guards";
import { writeAuditEvent } from "@/lib/security/audit";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export async function logoutAction() {
  const context = await getAuthContext();
  const requestHeaders = await headers();

  if (context) {
    try {
      await writeAuditEvent({
        organizationId: context.profile.organization_id,
        actorUserId: context.user.id,
        action: "auth.logout",
        entityType: "session",
        ip: getClientIp(requestHeaders),
        userAgent: getUserAgent(requestHeaders),
      });
    } catch {
      // El cierre de sesión nunca debe quedar bloqueado por la auditoría.
    }
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
