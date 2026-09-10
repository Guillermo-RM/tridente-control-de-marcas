import { notFound } from "next/navigation";

import { updateWorkerAction } from "@/app/actions/workers";
import { ErrorBanner } from "@/components/forms/error-banner";
import { WorkerForm } from "@/components/forms/worker-form";
import { getWorker } from "@/lib/data/master";

export default async function EditWorkerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { worker, assignments, condominiums } = await getWorker(id);
  if (!worker) notFound();
  return <section className="form-page"><span className="eyebrow">Edición</span><h1>{worker.full_name}</h1><ErrorBanner message={typeof query.error === "string" ? query.error : undefined} /><WorkerForm action={updateWorkerAction.bind(null, id)} condominiums={condominiums} selectedIds={assignments.map((item) => item.condominium_id)} worker={worker} /></section>;
}
