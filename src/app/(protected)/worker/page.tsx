import Link from "next/link";

import { requireWorker } from "@/lib/auth/guards";

export default async function WorkerPage() {
  const { profile } = await requireWorker();

  return (
    <section className="worker-panel">
      <span className="eyebrow">Área de trabajador</span>
      <h1>Hola, {profile.full_name}</h1>
      <article className="module-card scan-placeholder">
        <span className="scan-icon" aria-hidden="true">⌗</span>
        <h2>Escáner protegido</h2>
        <p>Usa la cámara del dispositivo para registrar el punto de tu recorrido.</p>
        <Link className="primary-link worker-primary-action" href="/scan">Abrir escáner</Link>
      </article>
    </section>
  );
}
