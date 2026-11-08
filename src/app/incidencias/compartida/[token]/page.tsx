import type { Metadata } from "next";
import { IncidentDetail } from "@/components/incidents/incident-detail";
import { getIncidentDetail } from "@/lib/data/incident-detail";
import { verifyIncidentShare } from "@/lib/security/incident-share";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Incidencia compartida | Tridente Control",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default async function SharedIncidentPage({ params }: PageProps<"/incidencias/compartida/[token]">) {
  const { token } = await params;
  const share = verifyIncidentShare(token);
  const incident = share ? await getIncidentDetail(share.id, share.organizationId) : null;
  return (
    <main className="app-content">
      <section className="form-page mx-auto">
        <span className="eyebrow">Tridente Control</span>
        <h1>Incidencia compartida</h1>
        {incident ? <IncidentDetail incident={incident} photoSrc={`/api/shared-incidents/${token}`} /> : (
          <p className="lead">El enlace no está disponible o ya venció. Solicita uno nuevo a quien te lo compartió.</p>
        )}
      </section>
    </main>
  );
}
