import Link from "next/link";

import { InfiniteScanTable } from "@/components/reports/infinite-scan-table";
import {
  getMasterReportPage,
  getReportCondominiums,
} from "@/lib/data/reports";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requestedId =
    typeof query.condominiumId === "string" ? query.condominiumId : "";
  const requestedWorkerId =
    typeof query.workerId === "string" ? query.workerId : "";
  const from = typeof query.from === "string" ? query.from : "";
  const to = typeof query.to === "string" ? query.to : "";
  const { context, condominiums, workers } = await getReportCondominiums();
  const condominiumId = condominiums.some((item) => item.id === requestedId)
    ? requestedId
    : "";
  const workerId = workers.some((item) => item.id === requestedWorkerId)
    ? requestedWorkerId
    : "";
  const filters = {
    workerId: workerId || undefined,
    from: from || undefined,
    to: to || undefined,
  };
  const firstPage = condominiumId
    ? await getMasterReportPage(
        context.profile.organization_id,
        condominiumId,
        null,
        filters,
      )
    : null;
  const exportParams = new URLSearchParams({ condominiumId });
  if (workerId) exportParams.set("workerId", workerId);
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Histórico de seis meses</span>
          <h1>Reporte de marcas</h1>
        </div>
        {condominiumId ? (
          <Link className="secondary-link" href={`/api/reports/scans.csv?${exportParams}`}>
            Exportar CSV
          </Link>
        ) : null}
      </div>
      <form className="filter-bar report-filter-bar">
        <label>
          Condominio
          <select defaultValue={condominiumId} name="condominiumId" required>
            <option disabled value="">Selecciona un condominio</option>
            {condominiums.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          Oficial
          <select defaultValue={workerId} name="workerId">
            <option value="">Todos los oficiales</option>
            {workers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
          </select>
        </label>
        <label>
          Desde
          <input defaultValue={from} name="from" type="date" />
        </label>
        <label>
          Hasta
          <input defaultValue={to} name="to" type="date" />
        </label>
        <button type="submit">Ver marcas</button>
        {condominiumId || workerId || from || to ? (
          <Link className="secondary-link report-clear-link" href="/master/reports">
            Limpiar filtros
          </Link>
        ) : null}
      </form>
      {firstPage ? (
        <InfiniteScanTable
          condominiumId={condominiumId}
          filters={filters}
          initialEvents={firstPage.events}
          initialNextCursor={firstPage.nextCursor}
          key={`${condominiumId}:${workerId}:${from}:${to}`}
        />
      ) : (
        <div className="table-wrap">
          <p className="empty-state">Selecciona un condominio para consultar sus marcas.</p>
        </div>
      )}
    </section>
  );
}
