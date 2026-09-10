import { notFound } from "next/navigation";

import { updateCondominiumAction } from "@/app/actions/condominiums";
import { CondominiumForm } from "@/components/forms/condominium-form";
import { ErrorBanner } from "@/components/forms/error-banner";
import { getCondominium } from "@/lib/data/master";

export default async function EditCondominiumPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { condominium } = await getCondominium(id);
  if (!condominium) notFound();
  return <section className="form-page"><span className="eyebrow">Edición</span><h1>{condominium.name}</h1><ErrorBanner message={typeof query.error === "string" ? query.error : undefined} /><CondominiumForm action={updateCondominiumAction.bind(null, id)} condominium={condominium} /></section>;
}
