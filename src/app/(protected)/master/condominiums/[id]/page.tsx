import Link from "next/link";
import { notFound } from "next/navigation";

import { getCondominiumWorkspace } from "@/lib/data/master";

export default async function CondominiumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { condominium, checkpoints, workers } = await getCondominiumWorkspace(id);
  if (!condominium) notFound();

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Condominio</span>
          <h1>{condominium.name}</h1>
          <p className="lead compact-lead">{condominium.address}</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-link" href="/master/condominiums">Volver</Link>
          <Link className="secondary-link" href={`/master/condominiums/${id}/edit`}>Editar</Link>
        </div>
      </div>

      <div className="module-grid condominium-modules">
        <article className="module-card">
          <span className="metric">{checkpoints.filter((item) => item.active).length}</span>
          <h2>Puntos QR</h2>
          <p>Agrega, consulta, edita o elimina los QR de este condominio.</p>
          <Link href={`/master/condominiums/${id}/checkpoints`}>Ver puntos QR</Link>
        </article>
        <article className="module-card">
          <span className="metric">{workers.filter((item) => item.active).length}</span>
          <h2>Trabajadores asignados</h2>
          <p>Consulta trabajadores, sus marcas recientes y el espacio de incidencias.</p>
          <Link href={`/master/condominiums/${id}/workers`}>Ver trabajadores asignados</Link>
        </article>
      </div>
    </section>
  );
}
