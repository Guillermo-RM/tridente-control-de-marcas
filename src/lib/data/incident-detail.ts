import "server-only";

import { uuidSchema } from "@/lib/domain/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getIncidentDetail(id: string, organizationId: string) {
  if (!uuidSchema.safeParse(id).success) return null;
  const { data, error } = await createAdminClient().from("incident_reports")
    .select("id, condominium_id, worker_id, worker_name_snapshot, condominium_name_snapshot, incident_type, description, status, reported_at, latitude, longitude, accuracy_meters, evidence_path, evidence_mime_type")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la incidencia.");
  return data;
}

export async function incidentPhoto(id: string, organizationId: string) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const incident = await getIncidentDetail(id, organizationId);
    if (!incident || !["image/jpeg", "image/png", "image/webp"].includes(incident.evidence_mime_type)) {
      return new Response(null, { status: 404, headers });
    }
    const { data, error } = await createAdminClient().storage.from("incident-evidence").download(incident.evidence_path);
    if (error || !data) return new Response(null, { status: 404, headers });
    return new Response(data, { headers: { ...headers, "Content-Type": incident.evidence_mime_type } });
  } catch {
    return new Response(null, { status: 500, headers });
  }
}
