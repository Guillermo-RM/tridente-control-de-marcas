import { createWorkerAction } from "@/app/actions/workers";
import { ErrorBanner } from "@/components/forms/error-banner";
import { WorkerForm } from "@/components/forms/worker-form";
import { getMasterData } from "@/lib/data/master";

export default async function NewWorkerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ condominiums }, query] = await Promise.all([getMasterData(), searchParams]);
  return <section className="form-page"><span className="eyebrow">Nueva cuenta</span><h1>Crear trabajador</h1><ErrorBanner message={typeof query.error === "string" ? query.error : undefined} /><WorkerForm action={createWorkerAction} condominiums={condominiums.filter((item) => item.active)} creating /></section>;
}
