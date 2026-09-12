import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/guards";
import { incidentStatusSchema, uuidSchema } from "@/lib/domain/schemas";
import { writeAuditEvent } from "@/lib/security/audit";
import { getClientIp, getUserAgent, hasSameOrigin } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthContext();
  if (!context || context.profile.role !== "master") {
    return NextResponse.json({ message: "Acceso no autorizado." }, { status: 401 });
  }
  if (!hasSameOrigin(request.headers)) {
    return NextResponse.json({ message: "Solicitud no autorizada." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = incidentStatusSchema.safeParse(body?.status);
  if (!uuidSchema.safeParse(id).success || !status.success) {
    return NextResponse.json({ message: "Datos no válidos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const before = await admin.from("incident_reports").select("id, status")
    .eq("id", id).eq("organization_id", context.profile.organization_id).maybeSingle();
  if (!before.data) return NextResponse.json({ message: "Incidencia no encontrada." }, { status: 404 });

  const update = await admin.from("incident_reports").update({
    status: status.data,
    status_updated_by: context.user.id,
    status_updated_at: new Date().toISOString(),
  }).eq("id", id).eq("organization_id", context.profile.organization_id).select("id, status").maybeSingle();
  if (update.error || !update.data) {
    return NextResponse.json({ message: "No se pudo cambiar el estado." }, { status: 500 });
  }

  await writeAuditEvent({
    organizationId: context.profile.organization_id,
    actorUserId: context.user.id,
    action: "incident.status_changed",
    entityType: "incident",
    entityId: id,
    before: { status: before.data.status },
    after: { status: update.data.status },
    ip: getClientIp(request.headers),
    userAgent: getUserAgent(request.headers),
  });
  return NextResponse.json(update.data);
}
