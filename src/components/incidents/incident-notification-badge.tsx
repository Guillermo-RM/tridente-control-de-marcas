"use client";

import { useCallback, useEffect, useState } from "react";

import { INCIDENT_NOTIFICATIONS_CHANGED } from "@/lib/domain/incidents";

export function IncidentNotificationBadge({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  const refresh = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    try {
      const response = await fetch("/api/incidents/unread", { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json() as { count?: number };
      setCount(Math.max(0, Number(result.count) || 0));
    } catch {
      // A notification failure must not interrupt navigation.
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

  return count > 0 ? (
    <span aria-label={`${count} incidencias sin revisar`} className="nav-notification-badge">
      {count > 99 ? "99+" : count}
    </span>
  ) : null;
}
