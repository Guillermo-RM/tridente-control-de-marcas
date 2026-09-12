import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/guards";
import { getRecentUnreadIncidentNotifications, getUnreadIncidentCount } from "@/lib/data/incidents";
import { hasSameOrigin } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

const viewedSchema = z.object({ incidentIds: z.array(z.uuid()).min(1).max(50) });

export async function GET() {
  const context = await getAuthContext();
  if (!context || context.profile.role !== "master") {
    return NextResponse.json({ message: "Acceso no autorizado." }, { status: 401 });
  }

  try {
    const [count, incidents] = await Promise.all([
      getUnreadIncidentCount(context),
      getRecentUnreadIncidentNotifications(context),
    ]);
    return NextResponse.json({ count, incidents }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ message: "No se pudo consultar la notificación." }, { status: 500 });
  }
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
