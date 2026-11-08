import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { QrScanner } from "@/components/scanner/qr-scanner";
import { getAuthContext } from "@/lib/auth/guards";

export default async function ScanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : undefined;
  const context = await getAuthContext();
  if (!context) redirect(`/login?next=${encodeURIComponent(`/scan${token ? `?token=${encodeURIComponent(token)}` : ""}`)}`);
  if (context.profile.role !== "worker") redirect("/master/condominiums");

  return (
    <AppShell context={context} initialUnreadIncidents={0}>
      <section className="worker-panel worker-scan-page">
        <BackLink href="/worker" label="Volver al inicio" />
        <span className="eyebrow">Registro de recorrido</span>
        <h1>Escanear punto QR</h1>
        <p className="lead">Activa la ubicación y la cámara para dejar una marca verificable.</p>
        <QrScanner initialToken={token} />
      </section>
    </AppShell>
  );
}
