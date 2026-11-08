import Image from "next/image";
import type { getIncidentDetail } from "@/lib/data/incident-detail";
import { INCIDENT_STATUS_LABELS, INCIDENT_TYPE_LABELS, type IncidentStatus, type IncidentType } from "@/lib/domain/incidents";
import { formatCostaRicaDateTime } from "@/lib/format/costa-rica-date";

export function IncidentDetail({ incident, photoSrc }: {
  incident: NonNullable<Awaited<ReturnType<typeof getIncidentDetail>>>;
  photoSrc: string;
}) {
  return (
    <article className="module-card grid gap-5 break-words">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt className="font-bold">Condominio</dt><dd>{incident.condominium_name_snapshot}</dd></div>
        <div><dt className="font-bold">Oficial</dt><dd>{incident.worker_name_snapshot}</dd></div>
        <div><dt className="font-bold">Fecha y hora</dt><dd>{formatCostaRicaDateTime(incident.reported_at)}</dd></div>
        <div><dt className="font-bold">Tipo</dt><dd>{INCIDENT_TYPE_LABELS[incident.incident_type as IncidentType]}</dd></div>
        <div><dt className="font-bold">Estado</dt><dd>{INCIDENT_STATUS_LABELS[incident.status as IncidentStatus]}</dd></div>
        <div>
          <dt className="font-bold">Ubicación</dt>
          <dd>
            <a href={`https://www.google.com/maps?q=${incident.latitude},${incident.longitude}`} target="_blank" rel="noreferrer">Ver mapa</a>
            <span> · Precisión ±{Math.round(incident.accuracy_meters)} m</span>
          </dd>
        </div>
      </dl>
      <div><h2 className="!mt-0">Descripción</h2><p className="whitespace-pre-wrap">{incident.description}</p></div>
      <figure>
        <figcaption className="mb-2 font-bold">Fotografía de evidencia</figcaption>
        <Image alt="Fotografía de evidencia de la incidencia" className="h-auto max-h-[75vh] w-full rounded-lg object-contain" src={photoSrc} width={1600} height={1200} unoptimized />
      </figure>
    </article>
  );
}
