import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

import { getAuthContext } from "@/lib/auth/guards";
import { downloadIncidentPhoto, getIncidentDetail } from "@/lib/data/incident-detail";
import { INCIDENT_STATUS_LABELS, INCIDENT_TYPE_LABELS, type IncidentStatus, type IncidentType } from "@/lib/domain/incidents";
import { formatCostaRicaDateTime } from "@/lib/format/costa-rica-date";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthContext();
  if (!context || context.profile.role !== "master") {
    return new Response("Acceso no autorizado.", { status: context ? 403 : 401, headers });
  }

  try {
    const incident = await getIncidentDetail((await params).id, context.profile.organization_id);
    if (!incident) return new Response("Incidencia no encontrada.", { status: 404, headers });
    const photo = await downloadIncidentPhoto(incident);
    if (!photo) return new Response("No se pudo cargar la fotografía de evidencia.", { status: 502, headers });

    const pdf = new jsPDF({ format: "a4", compress: true, putOnlyUsedFonts: true });
    const margin = 14;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pdf.internal.pageSize.getWidth() - margin * 2;
    pdf.setProperties({ title: "Control de Rondas - Reporte de incidencia" });
    pdf.setFontSize(17);
    pdf.text("Control de Rondas | Reporte de incidencia", margin, 19);

    let nextY = 26;
    autoTable(pdf, {
      startY: nextY,
      margin: { top: margin, right: margin, bottom: 24, left: margin },
      theme: "striped",
      styles: { fontSize: 10, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: 36, fontStyle: "bold" } },
      body: [
        ["Condominio", incident.condominium_name_snapshot],
        ["Oficial", incident.worker_name_snapshot],
        ["Fecha y hora", `${formatCostaRicaDateTime(incident.reported_at)} (Costa Rica)`],
        ["Tipo", INCIDENT_TYPE_LABELS[incident.incident_type as IncidentType]],
        ["Estado", INCIDENT_STATUS_LABELS[incident.status as IncidentStatus]],
        ["Ubicación", `${incident.latitude}, ${incident.longitude} (precisión ±${Math.round(incident.accuracy_meters)} m)`],
        ["Descripción", incident.description],
      ],
      didDrawPage: ({ cursor }) => { if (cursor) nextY = cursor.y; },
    });
    pdf.setFontSize(10);
    pdf.textWithLink("Ver ubicación en el mapa", margin, nextY + 6, {
      url: `https://www.google.com/maps?q=${incident.latitude},${incident.longitude}`,
    });

    const bytes = new Uint8Array(await photo.arrayBuffer());
    const { width, height, fileType } = pdf.getImageProperties(bytes);
    if (!(width > 0 && height > 0)) throw new Error("Invalid evidence dimensions");
    const scale = Math.min(contentWidth / width, 190 / height);
    const imageWidth = width * scale;
    const imageHeight = height * scale;
    let photoY = nextY + 18;
    if (photoY + imageHeight + 6 > pageHeight - margin) {
      pdf.addPage();
      photoY = 19;
    }
    pdf.setFontSize(12);
    pdf.text("Fotografía de evidencia", margin, photoY);
    pdf.addImage(bytes, fileType, margin + (contentWidth - imageWidth) / 2, photoY + 6, imageWidth, imageHeight);

    const pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      pdf.setPage(page);
      pdf.setFontSize(9);
      pdf.text(`Página ${page} de ${pages}`, margin, pageHeight - 6);
    }
    return new Response(pdf.output("arraybuffer"), {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="incidencia-${incident.id}.pdf"`,
      },
    });
  } catch {
    return new Response("No se pudo generar el reporte en PDF.", { status: 500, headers });
  }
}

