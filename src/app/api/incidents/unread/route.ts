import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/guards";
import { hasSameOrigin } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

const viewedSchema = z.object({ incidentIds: z.array(z.uuid()).min(1).max(50) });

export async function GET() {
  const context = await getAuthContext();
  if (!context || context.profile.role !== "master") {
    return NextResponse.json({ message: "Acceso no autorizado." }, { status: 401 });
  }

  const { data, error } = await createAdminClient().rpc("count_unread_incident_reports", {
    p_master_id: context.user.id,
    p_organization_id: context.profile.organization_id,
  });
  if (error) {
    console.error("[api/incidents/unread] count failed", error.code);
    return NextResponse.json({ message: "No se pudo consultar la notificación." }, { status: 500 });
  }
  return NextResponse.json({ count: Math.max(0, Number(data) || 0) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context || context.profile.role !== "master") {
    return NextResponse.json({ message: "Acceso no autorizado." }, { status: 401 });
  }
  if (!hasSameOrigin(request.headers)) {
    return NextResponse.json({ message: "Solicitud no autorizada." }, { status: 403 });
  }

  const parsed = viewedSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Datos no válidos." }, { status: 400 });
  const { data, error } = await createAdminClient().rpc("mark_incident_reports_viewed", {
    p_master_id: context.user.id,
    p_organization_id: context.profile.organization_id,
    p_incident_ids: parsed.data.incidentIds,
  });
  if (error) {
    console.error("[api/incidents/unread] mark failed", error.code);
    return NextResponse.json({ message: "No se pudieron marcar como vistas." }, { status: 500 });
  }
  return NextResponse.json({ marked: Math.max(0, Number(data) || 0) });
}
