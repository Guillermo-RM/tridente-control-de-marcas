import Link from "next/link";
import { notFound } from "next/navigation";

import { ScanLocation } from "@/components/scan-location";
import { getCondominiumWorkspace } from "@/lib/data/master";

export default async function CondominiumWorkersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { condominium, workers, events } = await getCondominiumWorkspace(id);
  if (!condominium) notFound();

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{condominium.name}</span>
          <h1>Trabajadores asignados</h1>
        </div>
        <Link className="secondary-link" href={`/master/condominiums/${id}`}>Volver</Link>
      </div>

      <div className="entity-list">
        {workers.map((worker) => {
          const workerEvents = events.filter((event) => event.worker_id === worker.id);
          return (
            <article className="worker-operation-card" key={worker.id}>
              <div className="worker-operation-heading">
                <div>
                  <span className={worker.active ? "status-chip" : "status-chip inactive"}>{worker.active ? "Activo" : "Archivado"}</span>
                  <h2>{worker.full_name}</h2>
                  <p>{worker.employee_code} · @{worker.nickname}</p>
                </div>
                <Link className="secondary-link" href={`/master/reports?condominiumId=${id}&workerId=${worker.id}`}>Todas las marcas</Link>
              </div>

              <div className="worker-operation-grid">
                <div>
                  <h3>Últimas marcas ({workerEvents.length})</h3>
                  <div className="compact-mark-list">
                    {workerEvents.slice(0, 5).map((event) => (
                      <div className="compact-mark" key={event.id}>
                        <div><strong>{event.checkpoint_name_snapshot}</strong><time>{new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Costa_Rica" }).format(new Date(event.scanned_at))}</time></div>
                        <ScanLocation
                          compact
                          latitude={event.latitude}
                          longitude={event.longitude}
                          status={event.location_status}
                        />
                      </div>
                    ))}
                    {workerEvents.length === 0 ? <p className="empty-inline">Sin marcas durante los últimos seis meses.</p> : null}
                  </div>
                </div>
                <div className="incidents-placeholder">
                  <h3>Incidencias</h3>
                  <p>Consulta los reportes de este oficial dentro del condominio.</p>
                  <Link href={`/master/incidents?condominiumId=${id}&workerId=${worker.id}`}>Ver incidencias</Link>
                </div>
              </div>
            </article>
          );
        })}
        {workers.length === 0 ? <p className="empty-state">No hay trabajadores asignados a este condominio.</p> : null}
      </div>
    </section>
  );
}
