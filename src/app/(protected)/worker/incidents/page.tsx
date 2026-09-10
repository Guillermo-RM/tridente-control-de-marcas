import { requireWorker } from "@/lib/auth/guards";

export default async function WorkerIncidentsPage() {
  await requireWorker();

  return (
    <section className="worker-panel">
      <span className="eyebrow">Próximamente</span>
      <h1>Reportar incidencias</h1>
      <article className="module-card incident-placeholder">
        <h2>Módulo en preparación</h2>
        <p>El reporte de incidencias se incorporará en la última etapa del proyecto.</p>
      </article>
    </section>
  );
}
