import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";

import { deleteWorkerAction, updateWorkerAction } from "@/app/actions/workers";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { ErrorBanner } from "@/components/forms/error-banner";
import { WorkerForm } from "@/components/forms/worker-form";
import { getWorker } from "@/lib/data/master";

export default async function EditWorkerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { worker, assignments, condominiums } = await getWorker(id);
  if (!worker || worker.deleted_at) notFound();

  return (
    <section className="form-page">
      <BackLink href="/master/workers" label="Volver a trabajadores" />
      <span className="eyebrow">Edición</span>
      <h1>{worker.full_name}</h1>
      <ErrorBanner message={typeof query.error === "string" ? query.error : undefined} />
      {worker.active ? (
        <WorkerForm action={updateWorkerAction.bind(null, id)} condominiums={condominiums} selectedIds={assignments.map((item) => item.condominium_id)} worker={worker} />
      ) : (
        <p className="lead">Este trabajador está archivado.</p>
      )}
      <form action={deleteWorkerAction.bind(null, id)} className="mt-6">
        <ConfirmSubmitButton
          className="danger-button"
          message={`¿Eliminar a ${worker.full_name}? Perderá el acceso y desaparecerá del directorio. Sus marcas e incidencias se conservarán. Esta acción no se puede deshacer desde la app.`}
        >
          Eliminar trabajador
        </ConfirmSubmitButton>
      </form>
    </section>
  );
}
