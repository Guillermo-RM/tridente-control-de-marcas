import { notFound } from "next/navigation";

import { updateCheckpointAction } from "@/app/actions/checkpoints";
import { CheckpointForm } from "@/components/forms/checkpoint-form";
import { ErrorBanner } from "@/components/forms/error-banner";
import { getCheckpoint } from "@/lib/data/master";

export default async function EditCheckpointPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { checkpoint, condominiums } = await getCheckpoint(id);
  if (!checkpoint) notFound();
  return <section className="form-page"><span className="eyebrow">Edición</span><h1>{checkpoint.name}</h1><ErrorBanner message={typeof query.error === "string" ? query.error : undefined} /><CheckpointForm action={updateCheckpointAction.bind(null, id)} checkpoint={checkpoint} condominiums={condominiums} /></section>;
}
