import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type AuditEvent = {
  organizationId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

export async function writeAuditEvent(event: AuditEvent) {
  const { error } = await createAdminClient().from("audit_logs").insert({
    organization_id: event.organizationId,
    actor_user_id: event.actorUserId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    before_data: event.before ?? null,
    after_data: event.after ?? null,
    ip_address: event.ip === "unknown" ? null : event.ip,
    user_agent: event.userAgent ?? null,
  });

  if (error) {
    console.error("No se pudo registrar el evento de auditoria", error.code);
  }
}
