import { IncidentReportForm } from "@/components/incidents/incident-report-form";
import { requireWorker } from "@/lib/auth/guards";
import { getWorkerIncidentFormData } from "@/lib/data/incidents";

export default async function WorkerReportsPage() {
  await requireWorker();
  const { condominiums } = await getWorkerIncidentFormData();

  return (
    <section className="worker-panel incident-report-page">
      <span className="eyebrow">Reporte protegido</span>
      <h1>Reportes</h1>
      <IncidentReportForm condominiums={condominiums} />
    </section>
  );
}
