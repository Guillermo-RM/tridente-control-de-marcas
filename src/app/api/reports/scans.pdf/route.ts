import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

import { downloadScanReport } from "@/lib/export/scan-download";
import { formatCostaRicaDateTime } from "@/lib/format/costa-rica-date";
import { presentLocation } from "@/lib/geo/location-presentation";

export const runtime = "nodejs";

export function GET(request: Request) {
  return downloadScanReport(request, "pdf", ({ condominium, events, start, end }) => {
    const pdf = new jsPDF({ format: "a4", compress: true });
    const margin = 14;
    pdf.setProperties({ title: "Tridente Control - Reporte de marcas" });
    pdf.setFontSize(17);
    pdf.text("Tridente Control | Reporte de marcas", margin, 19);
    pdf.setFontSize(10);
    const condominiumLines = pdf.splitTextToSize(`Condominio: ${condominium.name}`, 182);
    pdf.text(condominiumLines, margin, 27);
    const detailsY = 27 + condominiumLines.length * 5;
    pdf.text(`Desde: ${formatCostaRicaDateTime(start)}  |  Hasta: ${formatCostaRicaDateTime(end)}`, margin, detailsY);
    pdf.text(`Total: ${events.length} marcas · Hora de Costa Rica`, margin, detailsY + 5);

    autoTable(pdf, {
      startY: detailsY + 10,
      margin: { top: 14, bottom: 16, left: margin, right: margin },
      head: [["Fecha y hora", "Oficial", "Punto QR", "Ubicación"]],
      body: events.length ? events.map((event) => [
        formatCostaRicaDateTime(event.scanned_at),
        event.worker_name_snapshot,
        event.checkpoint_name_snapshot,
        presentLocation(event.location_status, event.latitude, event.longitude).label,
      ]) : [[{ content: "No hay marcas para estos filtros.", colSpan: 4 }]],
      headStyles: { fillColor: [12, 91, 66] },
      styles: { fontSize: 9, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 49 }, 2: { cellWidth: 49 }, 3: { cellWidth: 39 } },
      showHead: "everyPage",
      rowPageBreak: "avoid",
    });

    const pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      pdf.setPage(page);
      pdf.setFontSize(9);
      pdf.text(`Página ${page} de ${pages}`, margin, 289);
    }
    return pdf.output("arraybuffer");
  });
}
