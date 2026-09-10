import Link from "next/link";

import { archiveCheckpointAction } from "@/app/actions/checkpoints";
import { ErrorBanner } from "@/components/forms/error-banner";
import { getMasterData } from "@/lib/data/master";

export default async function CheckpointsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ checkpoints }, query] = await Promise.all([getMasterData(), searchParams]);
  return <section><div className="page-heading"><div><span className="eyebrow">Control de recorridos</span><h1>Puntos QR</h1></div><Link className="primary-link" href="/master/checkpoints/new">Nuevo punto QR</Link></div><ErrorBanner message={typeof query.error === "string" ? query.error : undefined} /><div className="entity-list">{checkpoints.map((item) => <article className="entity-row" key={item.id}><div><span className={item.active ? "status-chip" : "status-chip inactive"}>{item.active ? "Activo" : "Archivado"}</span><h2>{item.name}</h2><p>{item.condominiums?.name ?? "Condominio"} · Radio {item.radius_meters} m</p></div>{item.active ? <div className="row-actions"><Link href={`/master/checkpoints/${item.id}/print`}>Ver QR</Link><Link href={`/master/checkpoints/${item.id}/edit`}>Editar</Link><form action={archiveCheckpointAction.bind(null, item.id)}><button className="danger-button" type="submit">Archivar</button></form></div> : null}</article>)}{checkpoints.length === 0 ? <p className="empty-state">Aún no hay puntos QR.</p> : null}</div></section>;
}
