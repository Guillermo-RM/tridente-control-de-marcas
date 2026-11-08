import "server-only";

import { getAuthContext } from "@/lib/auth/guards";
import { getMasterReportExport, REPORT_EXPORT_LIMIT } from "@/lib/data/reports";
import { uuidSchema } from "@/lib/domain/schemas";
import { safeCsvFileSegment } from "@/lib/export/csv";
import { costaRicaCsvDateTime } from "@/lib/format/costa-rica-date";

type ScanReport = Awaited<ReturnType<typeof getMasterReportExport>>;

const cacheHeaders = { "Cache-Control": "private, no-store" };

function failure(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { ...cacheHeaders, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function downloadScanReport(
  request: Request,
  format: "csv" | "pdf",
  render: (report: ScanReport) => string | ArrayBuffer,
) {
  const context = await getAuthContext();
  if (!context) return failure("Inicia sesión para exportar el reporte.", 401);
  if (context.profile.role !== "master") return failure("Acceso no autorizado.", 403);

  const params = new URL(request.url).searchParams;
  const condominiumId = params.get("condominiumId") ?? "";
  const workerId = params.get("workerId") || undefined;
  if (!uuidSchema.safeParse(condominiumId).success) {
    return failure("Selecciona un condominio válido.", 400);
  }
  if (workerId && !uuidSchema.safeParse(workerId).success) {
    return failure("Oficial no válido.", 400);
  }

  try {
    const report = await getMasterReportExport(context.profile.organization_id, condominiumId, {
      workerId,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
    });
    const name = safeCsvFileSegment(report.condominium.name);
    const { date } = costaRicaCsvDateTime(new Date());
    return new Response(render(report), {
      headers: {
        ...cacheHeaders,
        "Content-Type": format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="marcas-${name}-${date}.${format}"`,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "CONDOMINIUM_NOT_FOUND") return failure("Condominio no encontrado.", 404);
    if (code === "REPORT_EXPORT_LIMIT") {
      return failure(`El reporte supera las ${REPORT_EXPORT_LIMIT} marcas. Reduce el rango de fechas o selecciona un oficial.`, 422);
    }
    console.error("[reports/export] download failed", { format });
    return failure("No se pudo generar el reporte. Intenta de nuevo.", 500);
  }
}
