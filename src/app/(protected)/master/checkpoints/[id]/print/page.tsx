import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { rotateCheckpointTokenAction } from "@/app/actions/checkpoints";
import { PrintButton } from "@/components/print-button";
import { getCheckpoint } from "@/lib/data/master";
import { createQrToken } from "@/lib/security/qr-token";

export default async function PrintCheckpointPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { checkpoint } = await getCheckpoint(id);
  if (!checkpoint || !checkpoint.active) notFound();
  const token = createQrToken(checkpoint.id, checkpoint.token_version);
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const scanUrl = `${baseUrl}/scan?token=${encodeURIComponent(token)}`;
  const qrDataUrl = await QRCode.toDataURL(scanUrl, { errorCorrectionLevel: "H", margin: 2, width: 700 });

  return (
    <section className="print-sheet">
      <div className="print-controls no-print">
        <div className="print-control-group">
          <Link
            className="secondary-link"
            href={`/master/condominiums/${checkpoint.condominium_id}/checkpoints`}
          >
            Volver a puntos QR
          </Link>
          <PrintButton />
        </div>
        <form action={rotateCheckpointTokenAction.bind(null, id)}>
          <button className="danger-button" type="submit">
            Invalidar y generar otro
          </button>
        </form>
      </div>

      <span className="eyebrow no-print">{checkpoint.condominiums?.name}</span>
      <h1>{checkpoint.name}</h1>
      <p className="no-print">{checkpoint.description || "Punto de control de recorrido"}</p>
      <Image
        alt={`QR del punto ${checkpoint.name}`}
        height={420}
        preload
        src={qrDataUrl}
        unoptimized
        width={420}
      />
      <strong className="no-print">Escanea este código con Control de Rondas</strong>
      <small className="no-print">
        Versión {checkpoint.token_version} · Los códigos anteriores quedan inválidos al rotar.
      </small>
    </section>
  );
}

