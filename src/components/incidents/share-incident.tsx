"use client";

import { useState } from "react";

export function ShareIncident({ id }: { id: string }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");

  function generateLink() {
    setUrl(new URL(`/master/incidents/${id}`, window.location.origin).href);
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
      <p>Para abrir el enlace, se requiere una sesión de administrador de tu organización.</p>
      {url && (
        <input
          aria-label="Enlace de la incidencia"
          className="w-full rounded-lg border p-2"
          value={url}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {url ? (
          <button className="secondary-button" onClick={() => void copyLink()} type="button">
            Copiar enlace
          </button>
        ) : (
          <button className="primary-link" onClick={generateLink} type="button">
            Generar enlace
          </button>
        )}
        <a className="secondary-link" href={`/api/incidents/${id}/pdf`}>Exportar reporte como PDF</a>
      </div>
      {/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url) && (
        <p>Este enlace local solo funciona en esta computadora.</p>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
