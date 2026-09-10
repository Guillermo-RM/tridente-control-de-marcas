import { createCondominiumAction } from "@/app/actions/condominiums";
import { CondominiumForm } from "@/components/forms/condominium-form";
import { ErrorBanner } from "@/components/forms/error-banner";
import { requireMaster } from "@/lib/auth/guards";

export default async function NewCondominiumPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [, query] = await Promise.all([requireMaster(), searchParams]);
  return <section className="form-page"><span className="eyebrow">Nuevo registro</span><h1>Crear condominio</h1><ErrorBanner message={typeof query.error === "string" ? query.error : undefined} /><CondominiumForm action={createCondominiumAction} /></section>;
}
