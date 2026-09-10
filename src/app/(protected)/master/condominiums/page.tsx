import Link from "next/link";

import {
  archiveCondominiumAction,
  deleteCondominiumAction,
  restoreCondominiumAction,
} from "@/app/actions/condominiums";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { ErrorBanner } from "@/components/forms/error-banner";
import { NameFilteredDirectory } from "@/components/master/name-filtered-directory";
import { getCondominiumsList } from "@/lib/data/master";

export default async function CondominiumsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const { condominiums } = await getCondominiumsList();
  return (
    <section className="directory-page">
      <ErrorBanner message={typeof query.error === "string" ? query.error : undefined} />
      <NameFilteredDirectory
        action="/master/condominiums"
        actions={<Link className="primary-link" href="/master/condominiums/new">Nuevo condominio</Link>}
        emptyMessage="No se encontraron condominios con ese nombre."
        initialQuery={search}
        items={condominiums.map((item) => ({
          id: item.id,
          name: item.name,
          content: (
          <article className="entity-row">
            <div><span className={item.active ? "status-chip" : "status-chip inactive"}>{item.active ? "Activo" : "Archivado"}</span><h2>{item.name}</h2><p>{item.address}</p></div>
            {item.active ? (
              <div className="row-actions">
                <Link className="primary-link" href={`/master/condominiums/${item.id}`}>Administrar</Link>
                <Link href={`/master/condominiums/${item.id}/edit`}>Editar</Link>
                <form action={archiveCondominiumAction.bind(null, item.id)}>
                  <button className="danger-button" type="submit">Archivar</button>
                </form>
              </div>
            ) : (
              <div className="row-actions">
                <form action={restoreCondominiumAction.bind(null, item.id)}>
                  <button className="secondary-button" type="submit">Restaurar</button>
                </form>
                <form action={deleteCondominiumAction.bind(null, item.id)}>
                  <ConfirmSubmitButton
                    className="danger-button"
                    message={`¿Eliminar permanentemente ${item.name}? Esta acción no se puede deshacer.`}
                  >
                    Eliminar
                  </ConfirmSubmitButton>
                </form>
              </div>
            )}
          </article>
          ),
        }))}
        placeholder="Nombre del condominio"
      />
    </section>
  );
}
