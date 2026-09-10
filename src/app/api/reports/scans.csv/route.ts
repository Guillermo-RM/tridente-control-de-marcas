import { relationName } from "@/lib/data/relations";
import { getMasterReport } from "@/lib/data/reports";

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const { events } = await getMasterReport(
    {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      workerId: params.get("workerId") ?? undefined,
      condominiumId: params.get("condominiumId") ?? undefined,
    },
    10_000,
  );
  const rows = events.map((event) => [
    event.scanned_at,
    event.worker_name_snapshot,
    relationName(event.condominiums),
    event.checkpoint_name_snapshot,
    event.location_status,
    event.distance_meters,
    event.latitude,
    event.longitude,
    event.accuracy_meters,
    event.ip_address,
  ]);
  const csv = [
    ["Fecha UTC", "Trabajador", "Condominio", "Marca", "Estado ubicación", "Distancia m", "Latitud", "Longitud", "Precisión m", "IP"],
    ...rows,
  ].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="marcas-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
