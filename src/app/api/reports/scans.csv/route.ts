import { relationName } from "@/lib/data/relations";
import { csvRow } from "@/lib/export/csv";
import { downloadScanReport } from "@/lib/export/scan-download";
import { costaRicaCsvDateTime } from "@/lib/format/costa-rica-date";
import { presentLocation } from "@/lib/geo/location-presentation";

export function GET(request: Request) {
  return downloadScanReport(request, "csv", ({ events }) => {
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
    return `\uFEFF${csv}`;
  });
}
