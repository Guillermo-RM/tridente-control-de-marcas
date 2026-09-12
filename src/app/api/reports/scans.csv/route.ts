import { relationName } from "@/lib/data/relations";
import { getMasterReportExport } from "@/lib/data/reports";
import { uuidSchema } from "@/lib/domain/schemas";
import { csvRow, safeCsvFileSegment } from "@/lib/export/csv";
import { costaRicaCsvDateTime } from "@/lib/format/costa-rica-date";
import { presentLocation } from "@/lib/geo/location-presentation";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const condominiumId = params.get("condominiumId") ?? "";
  if (!uuidSchema.safeParse(condominiumId).success) {
    return Response.json(
      { message: "Selecciona un condominio válido." },
      { status: 400 },
    );
  }

  const workerId = params.get("workerId") || undefined;
  if (workerId && !uuidSchema.safeParse(workerId).success) {
    return Response.json({ message: "Oficial no válido." }, { status: 400 });
  }

  const { events, condominium } = await getMasterReportExport(condominiumId, {
    workerId,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
  });
  const rows = events.map((event) => {
    const location = presentLocation(event.location_status, event.latitude, event.longitude);
    const localDateTime = costaRicaCsvDateTime(event.scanned_at);
    return [
      localDateTime.date,
      localDateTime.time,
      event.worker_name_snapshot,
      relationName(event.condominiums),
      event.checkpoint_name_snapshot,
      location.label,
      event.latitude,
      event.longitude,
      event.accuracy_meters,
      event.distance_meters,
      location.mapUrl,
      event.ip_address,
      event.id,
      event.scanned_at,
    ];
  });
  const csv = [
    [
      "Fecha (Costa Rica)",
      "Hora (Costa Rica)",
      "Oficial",
      "Condominio",
      "Punto QR",
      "Estado de ubicación",
      "Latitud",
      "Longitud",
      "Precisión GPS (m)",
      "Distancia al punto QR (m)",
      "Mapa",
      "Dirección IP",
      "ID de marca",
      "Fecha y hora UTC",
    ],
    ...rows,
  ].map(csvRow).join("\r\n");
  const condominiumName = safeCsvFileSegment(condominium.name);
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="marcas-${condominiumName}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
