import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/guards";
import { uuidSchema } from "@/lib/domain/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthContext();
  if (!context || context.profile.role !== "master") {
    return NextResponse.json({ message: "Acceso no autorizado." }, { status: 401 });
  }
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ message: "Evidencia no encontrada." }, { status: 404 });
  }

  const admin = createAdminClient();
  const incident = await admin.from("incident_reports").select("evidence_path")
    .eq("id", id).eq("organization_id", context.profile.organization_id).maybeSingle();
  if (!incident.data) return NextResponse.json({ message: "Evidencia no encontrada." }, { status: 404 });

  const signed = await admin.storage.from("incident-evidence").createSignedUrl(
    incident.data.evidence_path,
    60,
  );
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ message: "No se pudo abrir la evidencia." }, { status: 500 });
  }
  return NextResponse.redirect(signed.data.signedUrl, 307);
}
