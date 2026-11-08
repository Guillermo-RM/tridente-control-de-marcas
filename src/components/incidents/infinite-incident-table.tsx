"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { INCIDENT_NOTIFICATIONS_CHANGED, INCIDENT_STATUS_LABELS, INCIDENT_TYPE_LABELS, incidentStatuses, type IncidentStatus } from "@/lib/domain/incidents";
import type { IncidentFilters, IncidentReport } from "@/lib/data/incidents";
import { formatCostaRicaDateTime } from "@/lib/format/costa-rica-date";

type PageResponse = { incidents: IncidentReport[]; nextCursor: string | null };

export function InfiniteIncidentTable({
  filters,
  initialIncidents,
  initialNextCursor,
}: {
  filters: IncidentFilters;
  initialIncidents: IncidentReport[];
  initialNextCursor: string | null;
}) {
  const [incidents, setIncidents] = useState(initialIncidents);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const viewRequestsRef = useRef(new Set<string>());

  const addFilters = useCallback((params: URLSearchParams) => {
    if (filters.condominiumId) params.set("condominiumId", filters.condominiumId);
    if (filters.workerId) params.set("workerId", filters.workerId);
    if (filters.status) params.set("status", filters.status);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }, [filters.condominiumId, filters.from, filters.status, filters.to, filters.workerId]);

  const detailFilters = new URLSearchParams();
  addFilters(detailFilters);

  const loadNext = useCallback(async () => {
    if (!nextCursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ cursor: nextCursor });
      addFilters(params);
      const response = await fetch(`/api/incidents?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const page = await response.json() as PageResponse;
      setIncidents((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...page.incidents.filter((item) => !ids.has(item.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      setError("No se pudieron precargar más incidencias.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [addFilters, nextCursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void loadNext();
    }, { rootMargin: "600px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNext, nextCursor]);

  useEffect(() => {
    const incidentIds = incidents
      .filter((item) => item.is_unread && !viewRequestsRef.current.has(item.id))
      .map((item) => item.id);
    if (incidentIds.length === 0) return;
    incidentIds.forEach((id) => viewRequestsRef.current.add(id));

    void fetch("/api/incidents/unread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidentIds }),
    }).then((response) => {
      if (!response.ok) throw new Error();
      window.dispatchEvent(new Event(INCIDENT_NOTIFICATIONS_CHANGED));
    }).catch(() => {
      incidentIds.forEach((id) => viewRequestsRef.current.delete(id));
    });
  }, [incidents]);

  async function updateStatus(id: string, status: IncidentStatus) {
    setUpdatingId(id);
    setError("");
    try {
      const response = await fetch(`/api/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message);
      setIncidents((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "No se pudo cambiar el estado.");
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div className="table-wrap incident-table-wrap">
      {error ? <p className="error-banner" role="alert">{error}</p> : null}
      <table>
        <thead><tr><th>Fecha</th><th>Oficial</th><th>Condominio</th><th>Tipo</th><th>Descripción</th><th>Evidencia</th><th>Ubicación</th><th>Estado</th></tr></thead>
        <tbody>
          {incidents.map((incident) => (
            <tr className={incident.is_unread ? "incident-row-unread" : undefined} id={`incident-${incident.id}`} key={incident.id}>
              <td>
                {formatCostaRicaDateTime(incident.reported_at)}
                {incident.is_unread ? <span className="incident-new-chip">Nueva</span> : null}
              </td>
              <td>{incident.worker_name_snapshot}</td>
              <td>{incident.condominium_name_snapshot}</td>
              <td>{INCIDENT_TYPE_LABELS[incident.incident_type]}</td>
              <td className="incident-description">{incident.description}</td>
              <td><Link className="map-link" href={`/master/incidents/${incident.id}?${detailFilters}`} prefetch={false}>Ver reporte y foto</Link></td>
              <td>
                <a className="map-link" href={`https://www.google.com/maps?q=${incident.latitude},${incident.longitude}`} rel="noreferrer" target="_blank">Ver mapa</a>
                <small className="incident-accuracy">± {Math.round(incident.accuracy_meters)} m</small>
              </td>
              <td>
                <select
                  aria-label={`Estado de incidencia de ${incident.worker_name_snapshot}`}
                  disabled={updatingId === incident.id}
                  onChange={(event) => void updateStatus(incident.id, event.target.value as IncidentStatus)}
                  value={incident.status}
                >
                  {incidentStatuses.map((status) => <option key={status} value={status}>{INCIDENT_STATUS_LABELS[status]}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {incidents.length === 0 ? <p className="empty-state">No hay incidencias para estos filtros.</p> : null}
      <div className="report-load-sentinel" ref={sentinelRef}>
        {loading ? <span>Cargando 50 incidencias más…</span> : null}
        {error && nextCursor ? <button className="secondary-button" onClick={() => void loadNext()} type="button">Reintentar carga</button> : null}
        {!nextCursor && incidents.length > 0 ? <span>Se mostraron todas las incidencias.</span> : null}
      </div>
    </div>
  );
}
