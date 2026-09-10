import Link from "next/link";

import { ScanLocation } from "@/components/scan-location";
import { relationName } from "@/lib/data/relations";
import { getMasterReport } from "@/lib/data/reports";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filters = {
    from: typeof query.from === "string" ? query.from : undefined,
    to: typeof query.to === "string" ? query.to : undefined,
    workerId: typeof query.workerId === "string" ? query.workerId : undefined,
    condominiumId:
      typeof query.condominiumId === "string" ? query.condominiumId : undefined,
  };
  const { events, workers, condominiums, start, end } =
    await getMasterReport(filters);
  const exportParams = new URLSearchParams(
    Object.entries(filters).filter(
      (entry): entry is [string, string] => Boolean(entry[1]),
    ),
  );

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Histórico de seis meses</span>
          <h1>Reporte de marcas</h1>
        </div>
        <Link className="secondary-link" href={`/api/reports/scans.csv?${exportParams}`}>
          Exportar CSV
        </Link>
      </div>
      <form className="filter-bar">
        <label>Desde<input defaultValue={start.toISOString().slice(0, 10)} name="from" type="date" /></label>
        <label>Hasta<input defaultValue={end.toISOString().slice(0, 10)} name="to" type="date" /></label>
        <label>Trabajador<select defaultValue={filters.workerId ?? ""} name="workerId"><option value="">Todos</option>{workers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label>
        <label>Condominio<select defaultValue={filters.condominiumId ?? ""} name="condominiumId"><option value="">Todos</option>{condominiums.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button type="submit">Filtrar</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Trabajador</th><th>Condominio</th><th>Marca</th><th>Ubicación</th><th>IP</th></tr></thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Costa_Rica" }).format(new Date(event.scanned_at))}</td>
                <td>{event.worker_name_snapshot}</td>
                <td>{relationName(event.condominiums)}</td>
                <td>{event.checkpoint_name_snapshot}</td>
                <td>
                  <ScanLocation
                    latitude={event.latitude}
                    longitude={event.longitude}
                    status={event.location_status}
                  />
                </td>
                <td>{event.ip_address ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 ? <p className="empty-state">No hay marcas para estos filtros.</p> : null}
      </div>
    </section>
  );
}
