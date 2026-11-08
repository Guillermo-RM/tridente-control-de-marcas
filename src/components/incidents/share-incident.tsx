"use client";

import { useState } from "react";

export function ShareIncident({ id }: { id: string }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function generateLink() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/incidents/${id}/share`, { method: "POST" });
      if (!response.ok) throw new Error();
      const { path } = await response.json() as { path: string };
      setUrl(new URL(path, window.location.origin).href);
    } catch {
      setMessage("No se pudo generar el enlace. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Enlace copiado.");
    } catch {
      setMessage("Selecciona y copia el enlace manualmente.");
    }
  }

  return (
    <section className="module-card mt-4 grid gap-3">
      <h2 className="!mt-0">Compartir incidencia</h2>
      <p>Cualquier persona con el enlace podrá ver el reporte, la ubicación y la foto. El enlace no vence.</p>
      {url ? <input aria-label="Enlace de la incidencia" className="w-full rounded-lg border p-2" value={url} readOnly onFocus={(event) => event.currentTarget.select()} /> : null}
      <div className="flex flex-wrap gap-2">
        {url ? (
          <button className="secondary-button" onClick={() => void copyLink()} type="button">Copiar enlace</button>
        ) : (
          <button className="primary-link" disabled={busy} onClick={() => void generateLink()} type="button">
            {busy ? "Generando…" : "Generar enlace"}
          </button>
        )}
        <a className="secondary-link" href={`/api/incidents/${id}/pdf`}>Exportar reporte como PDF</a>
      </div>
      {/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url) ? <p>Este enlace local solo funciona en esta computadora.</p> : null}
      <p role="status">{message}</p>
    </section>
  );
}
