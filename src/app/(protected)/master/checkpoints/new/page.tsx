import { createCheckpointAction } from "@/app/actions/checkpoints";
import { CheckpointForm } from "@/components/forms/checkpoint-form";
import { ErrorBanner } from "@/components/forms/error-banner";
import { getMasterData } from "@/lib/data/master";

export default async function NewCheckpointPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ condominiums }, query] = await Promise.all([getMasterData(), searchParams]);
  const activeCondominiums = condominiums.filter((item) => item.active);
  const requestedCondominiumId = typeof query.condominiumId === "string" ? query.condominiumId : undefined;
  const defaultCondominiumId = activeCondominiums.some((item) => item.id === requestedCondominiumId)
    ? requestedCondominiumId
    : undefined;
  return <section className="form-page"><span className="eyebrow">Nuevo control</span><h1>Crear punto QR</h1><p className="lead">Al guardarlo se generará un código firmado listo para imprimir.</p><ErrorBanner message={typeof query.error === "string" ? query.error : undefined} /><CheckpointForm action={createCheckpointAction} condominiums={activeCondominiums} defaultCondominiumId={defaultCondominiumId} /></section>;
}
