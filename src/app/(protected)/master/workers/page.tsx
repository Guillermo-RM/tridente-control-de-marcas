import Link from "next/link";

import { archiveWorkerAction } from "@/app/actions/workers";
import { ErrorBanner } from "@/components/forms/error-banner";
import { NameFilteredDirectory } from "@/components/master/name-filtered-directory";
import { getWorkersList } from "@/lib/data/master";

export default async function WorkersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const { workers } = await getWorkersList();
  return (
    <section className="directory-page">
      <ErrorBanner message={typeof query.error === "string" ? query.error : undefined} />
      <NameFilteredDirectory
        action="/master/workers"
        actions={<Link className="primary-link" href="/master/workers/new">Nuevo trabajador</Link>}
        emptyMessage="No se encontraron trabajadores con ese nombre."
        initialQuery={search}
        items={workers.map((item) => ({
          id: item.id,
          name: item.full_name,
          content: (
            <article className="entity-row">
              <div><span className={item.active ? "status-chip" : "status-chip inactive"}>{item.active ? "Activo" : "Archivado"}</span><h2>{item.full_name}</h2><p>Código {item.employee_code}</p></div>
              <div className="row-actions">
                <Link className="secondary-link worker-action-link" href={`/master/reports?workerId=${item.id}`}>Ver marcas</Link>
                <Link className="secondary-link worker-action-link" href={`/master/workers/${item.id}/incidents`}>Ver incidencias</Link>
                <Link className="secondary-link worker-action-link" href={`/master/workers/${item.id}/edit`}>Editar</Link>
                {item.active ? (
                  <form action={archiveWorkerAction.bind(null, item.id)}>
                    <button className="danger-button" type="submit">Archivar</button>
                  </form>
                ) : null}
              </div>
            </article>
          ),
        }))}
        placeholder="Nombre del trabajador"
      />
    </section>
  );
}
