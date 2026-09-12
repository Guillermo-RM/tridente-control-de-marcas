"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { INCIDENT_NOTIFICATIONS_CHANGED } from "@/lib/domain/incidents";
import { formatCostaRicaDateTime } from "@/lib/format/costa-rica-date";

type NotificationItem = {
  condominiumId: string;
  condominiumName: string;
  id: string;
  reportedAt: string;
  workerId: string;
  workerName: string;
};

type NotificationResponse = {
  count?: number;
  incidents?: NotificationItem[];
};

export function IncidentNotificationButton({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [incidents, setIncidents] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (showLoading = false) => {
    if (document.visibilityState === "hidden") return;
    if (showLoading) setIsLoading(true);
    try {
      const response = await fetch("/api/incidents/unread", { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json() as NotificationResponse;
      setCount(Math.max(0, Number(result.count) || 0));
      setIncidents(Array.isArray(result.incidents) ? result.incidents : []);
    } catch {
      // Notification failures must never interrupt the administration UI.
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), 30_000);
    const onVisibility = () => void refresh();
    window.addEventListener("focus", onVisibility);
    window.addEventListener(INCIDENT_NOTIFICATIONS_CHANGED, onVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisibility);
      window.removeEventListener(INCIDENT_NOTIFICATIONS_CHANGED, onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function toggle() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) void refresh(true);
  }

  return (
    <div className="incident-notification" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`${count} incidencias nuevas`}
        className="incident-notification-button"
        onClick={toggle}
        type="button"
      >
        <span aria-hidden="true" className="notification-symbol">!</span>
        <span>Incidencias</span>
        {count > 0 ? <span className="nav-notification-badge">{count > 99 ? "99+" : count}</span> : null}
      </button>
      {isOpen ? (
        <div className="incident-notification-menu" role="menu">
          <div className="notification-menu-heading">
            <strong>Incidencias nuevas</strong>
            <span>{count}</span>
          </div>
          {isLoading && incidents.length === 0 ? <p className="notification-empty">Cargando…</p> : null}
          {!isLoading && count === 0 ? <p className="notification-empty">No hay incidencias nuevas.</p> : null}
          {incidents.length > 0 ? (
            <div className="notification-list">
              {incidents.map((incident) => (
                <Link
                  href={`/master/incidents?condominiumId=${incident.condominiumId}&workerId=${incident.workerId}#incident-${incident.id}`}
                  key={incident.id}
                  onClick={() => setIsOpen(false)}
                  role="menuitem"
                >
                  <strong>{incident.workerName}</strong>
                  <span>{incident.condominiumName}</span>
                  <small>{formatCostaRicaDateTime(incident.reportedAt)}</small>
                </Link>
              ))}
            </div>
          ) : null}
          {count > incidents.length && incidents.length > 0 ? (
            <p className="notification-note">Se muestran las 50 más recientes.</p>
          ) : null}
          <Link className="notification-view-all" href="/master/incidents" onClick={() => setIsOpen(false)} role="menuitem">
            Abrir filtros de incidencias
          </Link>
        </div>
      ) : null}
    </div>
  );
}
