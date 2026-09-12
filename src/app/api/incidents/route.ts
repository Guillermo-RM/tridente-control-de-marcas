import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/guards";
import { getMasterIncidentPage } from "@/lib/data/incidents";
import { incidentReportSchema, incidentStatusSchema } from "@/lib/domain/schemas";
import { writeAuditEvent } from "@/lib/security/audit";
import { INCIDENT_IMAGE_MAX_BYTES, isAllowedIncidentImage } from "@/lib/security/image-upload";
import { consumeIncidentAttempt } from "@/lib/security/rate-limit";
import { getClientIp, getUserAgent, hasSameOrigin } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "incident-evidence";
const MAX_REQUEST_BYTES = 2_000_000;

function optionalParam(url: URL, name: string) {
  return url.searchParams.get(name)?.trim() || undefined;
}

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context || context.profile.role !== "master") {
    return NextResponse.json({ message: "Acceso no autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawStatus = optionalParam(url, "status");
  const status = rawStatus && incidentStatusSchema.safeParse(rawStatus).success
    ? incidentStatusSchema.parse(rawStatus)
    : undefined;
  if (rawStatus && !status) {
    return NextResponse.json({ message: "Filtro no válido." }, { status: 400 });
  }

  const filters = {
    condominiumId: optionalParam(url, "condominiumId"),
    workerId: optionalParam(url, "workerId"),
    status,
    from: optionalParam(url, "from"),
    to: optionalParam(url, "to"),
  };
  if (!filters.condominiumId && !filters.workerId && !filters.status && !filters.from && !filters.to) {
    return NextResponse.json({ message: "Selecciona al menos un filtro." }, { status: 400 });
  }

  try {
    const page = await getMasterIncidentPage(
      context.profile.organization_id,
      context.user.id,
      optionalParam(url, "cursor"),
      filters,
    );
    return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ message: "No se pudieron cargar las incidencias." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context || context.profile.role !== "worker") {
    return NextResponse.json({ message: "Acceso no autorizado." }, { status: 401 });
  }
  if (!hasSameOrigin(request.headers)) {
    return NextResponse.json({ message: "Solicitud no autorizada." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ message: "La fotografía supera el tamaño permitido." }, { status: 413 });
  }

  const rawIp = getClientIp(request.headers);
  if (!(await consumeIncidentAttempt(context.user.id, rawIp))) {
    return NextResponse.json({ message: "Has enviado demasiados reportes. Intenta nuevamente en 10 minutos." }, { status: 429 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ message: "Formulario no válido." }, { status: 400 });
  const parsed = incidentReportSchema.safeParse({
    condominiumId: formData.get("condominiumId"),
    incidentType: formData.get("incidentType"),
    description: formData.get("description"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    accuracyMeters: formData.get("accuracyMeters"),
  });
  const evidence = formData.get("evidence");
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
  }
  if (!(evidence instanceof File) || !(await isAllowedIncidentImage(evidence))) {
    return NextResponse.json({ message: `La fotografía debe ser JPG, PNG o WebP y pesar menos de ${Math.round(INCIDENT_IMAGE_MAX_BYTES / 1024 / 1024 * 10) / 10} MB.` }, { status: 400 });
  }

  const extension = evidence.type === "image/png" ? "png" : evidence.type === "image/webp" ? "webp" : "jpg";
  const evidencePath = `${context.profile.organization_id}/${context.user.id}/${randomUUID()}.${extension}`;
  const bytes = await evidence.arrayBuffer();
  const admin = createAdminClient();
  const upload = await admin.storage.from(BUCKET).upload(evidencePath, bytes, {
    contentType: evidence.type,
    cacheControl: "private, max-age=300",
    upsert: false,
  });
  if (upload.error) {
    console.error("[api/incidents] evidence upload failed", upload.error.message);
    return NextResponse.json({ message: "No se pudo guardar la fotografía." }, { status: 500 });
  }

  const ip = isIP(rawIp) ? rawIp : null;
  const result = await admin.rpc("record_incident_report", {
    p_worker_id: context.user.id,
    p_condominium_id: parsed.data.condominiumId,
    p_incident_type: parsed.data.incidentType,
    p_description: parsed.data.description,
    p_evidence_path: evidencePath,
    p_evidence_mime_type: evidence.type,
    p_evidence_size_bytes: evidence.size,
    p_latitude: parsed.data.latitude,
    p_longitude: parsed.data.longitude,
    p_accuracy_meters: parsed.data.accuracyMeters,
    p_ip_address: ip,
  });

  if (result.error || typeof result.data !== "string") {
    await admin.storage.from(BUCKET).remove([evidencePath]);
    const forbidden = result.error?.message.includes("assignment_required") || result.error?.message.includes("not_allowed");
    console.error("[api/incidents] record failed", result.error?.code ?? "INVALID_RPC_RESULT");
    return NextResponse.json({
      message: forbidden ? "Ya no estás asignado a ese condominio." : "No se pudo guardar la incidencia.",
    }, { status: forbidden ? 403 : 500 });
  }

  await writeAuditEvent({
    organizationId: context.profile.organization_id,
    actorUserId: context.user.id,
    action: "incident.create",
    entityType: "incident",
    entityId: result.data,
    after: {
      condominium_id: parsed.data.condominiumId,
      incident_type: parsed.data.incidentType,
      location_accuracy_meters: parsed.data.accuracyMeters,
      evidence_size_bytes: evidence.size,
    },
    ip,
    userAgent: getUserAgent(request.headers),
  });

  return NextResponse.json({ id: result.data, message: "Incidencia enviada correctamente." }, { status: 201 });
}
