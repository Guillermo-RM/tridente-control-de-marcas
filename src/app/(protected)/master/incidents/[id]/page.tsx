import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { IncidentDetail } from "@/components/incidents/incident-detail";
import { ShareIncident } from "@/components/incidents/share-incident";
import { requireMaster } from "@/lib/auth/guards";
import { getIncidentDetail } from "@/lib/data/incident-detail";

export default async function MasterIncidentDetailPage({
  params, searchParams,
}: PageProps<"/master/incidents/[id]">) {
  const [context, { id }, query] = await Promise.all([requireMaster(), params, searchParams]);
  const incident = await getIncidentDetail(id, context.profile.organization_id);
  if (!incident) notFound();

  const filters = new URLSearchParams();
  for (const key of ["condominiumId", "workerId", "status", "from", "to"]) {
    const value = query[key];
    if (typeof value === "string" && value.length <= 36) filters.set(key, value);
  }
  if (filters.size === 0) filters.set("condominiumId", incident.condominium_id);

  return (
    <section className="form-page">
      <BackLink href={`/master/incidents?${filters}#incident-${id}`} label="Volver a incidencias" />
      <h1>Detalle de incidencia</h1>
      <IncidentDetail incident={incident} photoSrc={`/api/incidents/${id}/evidence`} />
      <ShareIncident id={id} />
    </section>
  );
}
