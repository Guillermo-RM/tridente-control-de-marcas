import Link from "next/link";
import { notFound } from "next/navigation";

import {
  archiveCheckpointAction,
  deleteCheckpointAction,
  restoreCheckpointAction,
} from "@/app/actions/checkpoints";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { ErrorBanner } from "@/components/forms/error-banner";
import { getCondominiumWorkspace } from "@/lib/data/master";

export default async function CondominiumCheckpointsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { condominium, checkpoints } = await getCondominiumWorkspace(id);
  if (!condominium) notFound();

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{condominium.name}</span>
          <h1>Puntos QR</h1>
        </div>
        <div className="row-actions">
          <Link className="secondary-link" href={`/master/condominiums/${id}`}>Volver</Link>
          {condominium.active ? (
            <div className="flex flex-wrap gap-2">
              <Link className="secondary-link" href={`/master/condominiums/${id}/checkpoints/import`}>
                Utilizar QR existente
              </Link>
              <Link className="primary-link" href={`/master/checkpoints/new?condominiumId=${id}`}>
                Nuevo punto QR
              </Link>
            </div>
          ) : null}
        </div>
      </div>
      <ErrorBanner message={typeof query.error === "string" ? query.error : undefined} />
      {query.imported === "1" ? (
        <p className="status-chip">QR vinculado. Las marcas se recibirán en este servidor.</p>
      ) : null}

      <div className="entity-list">
        {checkpoints.map((checkpoint) => (
          <article className="entity-row" key={checkpoint.id}>
            <div>
              <span className={checkpoint.active ? "status-chip" : "status-chip inactive"}>{checkpoint.active ? "Activo" : "Archivado"}</span>
              <h2>{checkpoint.name}</h2>
              <p>{checkpoint.description || `Radio permitido: ${checkpoint.radius_meters} m`}</p>
            </div>
            {checkpoint.active ? (
              <div className="row-actions">
                <Link href={`/master/checkpoints/${checkpoint.id}/print`}>Ver QR</Link>
                <Link href={`/master/checkpoints/${checkpoint.id}/edit`}>Editar</Link>
                <form action={archiveCheckpointAction.bind(null, checkpoint.id)}>
                  <ConfirmSubmitButton
                    className="danger-button"
                    message={`¿Eliminar ${checkpoint.name}? Podrás recuperarlo mientras conserve historial.`}
                  >
                    Eliminar
                  </ConfirmSubmitButton>
                </form>
              </div>
            ) : (
              <div className="row-actions">
                <form action={restoreCheckpointAction.bind(null, checkpoint.id)}>
                  <button className="secondary-button" type="submit">Restaurar</button>
                </form>
                <form action={deleteCheckpointAction.bind(null, checkpoint.id)}>
                  <ConfirmSubmitButton
                    className="danger-button"
                    message={`¿Eliminar permanentemente ${checkpoint.name}? Esta acción no se puede deshacer.`}
                  >
                    Eliminar permanentemente
                  </ConfirmSubmitButton>
                </form>
              </div>
            )}
          </article>
        ))}
        {checkpoints.length === 0 ? <p className="empty-state">Este condominio aún no tiene puntos QR.</p> : null}
      </div>
    </section>
  );
}

