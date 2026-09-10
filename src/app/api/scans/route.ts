import { isIP } from "node:net";
import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/guards";
import { scanRequestSchema } from "@/lib/domain/schemas";
import { getClientIp } from "@/lib/security/request";
import { verifyQrToken } from "@/lib/security/qr-token";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context || context.profile.role !== "worker") {
    return NextResponse.json({ message: "Acceso no autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = scanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Lectura QR no válida." }, { status: 400 });
  }

  const token = verifyQrToken(parsed.data.token);
  if (!token) {
    return NextResponse.json({ message: "El QR no es válido o fue alterado." }, { status: 400 });
  }

  const admin = createAdminClient();
  const checkpointResult = await admin.from("checkpoints")
    .select("id, name, token_version, active, condominiums!inner(active)")
    .eq("id", token.checkpointId)
    .eq("organization_id", context.profile.organization_id)
    .eq("active", true)
    .eq("condominiums.active", true)
    .single();
  const checkpoint = checkpointResult.data;
  if (!checkpoint || checkpoint.token_version !== token.version) {
    return NextResponse.json({ message: "Este QR está inactivo o fue reemplazado." }, { status: 410 });
  }

  const rawIp = getClientIp(request.headers);
  const ip = isIP(rawIp) ? rawIp : null;
  let { data, error } = await admin.rpc("record_scan_event", {
    p_worker_id: context.user.id,
    p_checkpoint_id: checkpoint.id,
    p_ip_address: ip,
    p_latitude: parsed.data.latitude,
    p_longitude: parsed.data.longitude,
    p_accuracy_meters: parsed.data.accuracyMeters,
  });

  // Mantiene el escaneo disponible mientras 0007 se promueve entre entornos.
  if (error?.code === "PGRST202") {
    const legacyResult = await admin.rpc("record_scan_event", {
      p_worker_id: context.user.id,
      p_checkpoint_id: checkpoint.id,
      p_ip_address: ip,
      p_user_agent: null,
      p_latitude: parsed.data.latitude,
      p_longitude: parsed.data.longitude,
      p_accuracy_meters: parsed.data.accuracyMeters,
      p_distance_meters: null,
      p_location_status: "unavailable",
      p_client_scanned_at: null,
    });
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error || !Array.isArray(data) || !data[0]) {
    const diagnosticCode = error?.code ?? "INVALID_RPC_RESULT";
    console.error("[api/scans] record_scan_event failed", {
      code: diagnosticCode,
      message: error?.message ?? null,
      details: error?.details ?? null,
      hint: error?.hint ?? null,
      resultShape: Array.isArray(data) ? `array:${data.length}` : typeof data,
    });
    const forbidden = error?.message.includes("assignment_required") || error?.message.includes("not_allowed");
    return NextResponse.json(
      {
        message: forbidden
          ? "No estás asignado a este condominio."
          : `No se pudo guardar la marca. Código: ${diagnosticCode}`,
      },
      { status: forbidden ? 403 : 500 },
    );
  }

  let locationStatus = data[0].scan_location_status;
  if (!locationStatus) {
    const storedScan = await admin.from("scan_events")
      .select("location_status")
      .eq("id", data[0].scan_id)
      .single();
    locationStatus = storedScan.data?.location_status ?? "unavailable";
  }

  return NextResponse.json({
    id: data[0].scan_id,
    created: data[0].created,
    checkpointName: checkpoint.name,
    locationStatus,
    message: data[0].created ? "Marca guardada correctamente." : "Esta marca ya se registró hace menos de un minuto.",
  }, { status: data[0].created ? 201 : 200 });
}
