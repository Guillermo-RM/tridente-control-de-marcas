import Link from "next/link";

import { importCheckpointQrAction } from "@/app/actions/checkpoints";
import { ErrorBanner } from "@/components/forms/error-banner";
import { getCondominiumWorkspace } from "@/lib/data/master";

export default async function ImportCheckpointQrPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { condominium } = await getCondominiumWorkspace(id);
  if (!condominium?.active) return <p className="empty-state">Condominio no disponible.</p>;

  return (
    <section className="form-page">
      <Link className="secondary-link" href={`/master/condominiums/${id}/checkpoints`}>
        Volver a puntos QR
      </Link>
      <span className="eyebrow">Puntos QR · {condominium.name}</span>
      <h1>Utilizar QR existente</h1>
      <p className="lead">
        Asocia un código impreso con un punto de control. Las marcas se enviarán a este servidor
        cuando el oficial lo escanee desde la app.
      </p>
      <ErrorBanner message={typeof query.error === "string" ? query.error : undefined} />
      <form action={importCheckpointQrAction.bind(null, id)} className="entity-form">
        <label>
          Nombre del punto
          <input maxLength={120} minLength={2} name="name" placeholder="Acceso principal" required />
        </label>
        <label>
          Enlace o contenido del QR
          <textarea
            autoCapitalize="none"
            name="qrContent"
            placeholder="Pega aquí el enlace completo o el texto leído del QR"
            required
            rows={4}
          />
        </label>
        <label>
          Descripción
          <textarea maxLength={500} name="description" rows={3} />
        </label>
        <input name="radiusMeters" type="hidden" value="75" />
        <input name="latitude" type="hidden" value="" />
        <input name="longitude" type="hidden" value="" />
        <button type="submit">Vincular QR existente</button>
      </form>
    </section>
  );
}

