"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ScanLocation } from "@/components/scan-location";
import { relationName } from "@/lib/data/relations";
import type { ReportFilters, ReportScanEvent } from "@/lib/data/reports";
import { formatCostaRicaDateTime } from "@/lib/format/costa-rica-date";

type PageResponse = {
  events: ReportScanEvent[];
  nextCursor: string | null;
};

export function InfiniteScanTable({
  condominiumId,
  filters,
  initialEvents,
  initialNextCursor,
}: {
  condominiumId: string;
  filters: ReportFilters;
  initialEvents: ReportScanEvent[];
  initialNextCursor: string | null;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadNextPage = useCallback(async () => {
    if (!nextCursor || loadingRef.current) return;

    loadingRef.current = true;
    setIsLoading(true);
    setError("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const params = new URLSearchParams({ condominiumId, cursor: nextCursor });
      if (filters.workerId) params.set("workerId", filters.workerId);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      const response = await fetch(`/api/reports/scans?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("No se pudo cargar la siguiente página.");

      const page = (await response.json()) as PageResponse;
      setEvents((current) => {
        const knownIds = new Set(current.map((event) => event.id));
        return [...current, ...page.events.filter((event) => !knownIds.has(event.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError("No se pudieron precargar más marcas.");
      }
    } finally {
      if (!controller.signal.aborted) {
        loadingRef.current = false;
        setIsLoading(false);
      }
    }
  }, [condominiumId, filters.from, filters.to, filters.workerId, nextCursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadNextPage();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextPage, nextCursor]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Fecha</th><th>Trabajador</th><th>Condominio</th><th>Marca</th><th>Ubicación</th><th>IP</th></tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{formatCostaRicaDateTime(event.scanned_at)}</td>
              <td>{event.worker_name_snapshot}</td>
              <td>{relationName(event.condominiums)}</td>
              <td>{event.checkpoint_name_snapshot}</td>
              <td><ScanLocation latitude={event.latitude} longitude={event.longitude} status={event.location_status} /></td>
              <td>{event.ip_address ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {events.length === 0 ? <p className="empty-state">Este condominio todavía no tiene marcas.</p> : null}
      <div className="report-load-sentinel" ref={sentinelRef}>
        {isLoading ? <span>Cargando 50 marcas más…</span> : null}
        {error ? (
          <button className="secondary-button" onClick={() => void loadNextPage()} type="button">Reintentar carga</button>
        ) : null}
        {!nextCursor && events.length > 0 ? <span>Se mostraron todas las marcas de los últimos seis meses.</span> : null}
      </div>
    </div>
  );
}
