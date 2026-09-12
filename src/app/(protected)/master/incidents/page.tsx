import Link from "next/link";

import { InfiniteIncidentTable } from "@/components/incidents/infinite-incident-table";
import { getIncidentFacets, getMasterIncidentPage } from "@/lib/data/incidents";
import { INCIDENT_STATUS_LABELS, incidentStatuses, type IncidentStatus } from "@/lib/domain/incidents";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requestedCondominium = typeof query.condominiumId === "string" ? query.condominiumId : "";
  const requestedWorker = typeof query.workerId === "string" ? query.workerId : "";
  const requestedStatus = typeof query.status === "string" ? query.status : "";
  const from = typeof query.from === "string" ? query.from : "";
  const to = typeof query.to === "string" ? query.to : "";
  const { context, condominiums, workers } = await getIncidentFacets();
  const condominiumId = condominiums.some((item) => item.id === requestedCondominium) ? requestedCondominium : "";
  const workerId = workers.some((item) => item.id === requestedWorker) ? requestedWorker : "";
  const status = incidentStatuses.includes(requestedStatus as IncidentStatus) ? requestedStatus as IncidentStatus : undefined;
  const filters = {
    condominiumId: condominiumId || undefined,
    workerId: workerId || undefined,
    status,
    from: from || undefined,
    to: to || undefined,
  };
  const hasFilters = Boolean(condominiumId || workerId || status || from || to);
  const firstPage = hasFilters
    ? await getMasterIncidentPage(context.profile.organization_id, context.user.id, null, filters)
    : { incidents: [], nextCursor: null };

  return (
    <section>
      <div className="page-heading">
        <div><span className="eyebrow">Seguimiento operativo</span><h1>Incidencias</h1></div>
      </div>
      <form className="filter-bar incident-filter-bar">
        <label>Condominio<select defaultValue={condominiumId} name="condominiumId"><option value="">Seleccionar</option>{condominiums.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Oficial<select defaultValue={workerId} name="workerId"><option value="">Seleccionar</option>{workers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label>
        <label>Estado<select defaultValue={status ?? ""} name="status"><option value="">Cualquier estado</option>{incidentStatuses.map((item) => <option key={item} value={item}>{INCIDENT_STATUS_LABELS[item]}</option>)}</select></label>
        <label>Desde<input defaultValue={from} name="from" type="date" /></label>
        <label>Hasta<input defaultValue={to} name="to" type="date" /></label>
        <button type="submit">Filtrar</button>
        {condominiumId || workerId || status || from || to ? <Link className="secondary-link report-clear-link" href="/master/incidents">Limpiar filtros</Link> : null}
      </form>
      {hasFilters ? (
        <InfiniteIncidentTable
          filters={filters}
          initialIncidents={firstPage.incidents}
          initialNextCursor={firstPage.nextCursor}
          key={`${condominiumId}:${workerId}:${status}:${from}:${to}`}
        />
      ) : (
        <div className="table-wrap incidents-filter-prompt">
          <strong>Selecciona al menos un filtro</strong>
          <p>Las incidencias se cargarán únicamente por condominio, oficial, estado o rango de fechas.</p>
        </div>
      )}
    </section>
  );
}
