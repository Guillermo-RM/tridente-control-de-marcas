import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/guards";
import { getMasterReportPage } from "@/lib/data/reports";

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context || context.profile.role !== "master") {
    return NextResponse.json({ message: "Acceso no autorizado." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const condominiumId = params.get("condominiumId") ?? "";
  const cursor = params.get("cursor");
  const filters = {
    workerId: params.get("workerId") || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
  };

  try {
    const page = await getMasterReportPage(
      context.profile.organization_id,
      condominiumId,
      cursor,
      filters,
    );
    return NextResponse.json(
      { events: page.events, nextCursor: page.nextCursor },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_CONDOMINIUM" || code === "INVALID_CURSOR" || code === "INVALID_WORKER") {
      return NextResponse.json({ message: "Parámetros no válidos." }, { status: 400 });
    }
    if (code === "CONDOMINIUM_NOT_FOUND") {
      return NextResponse.json({ message: "Condominio no encontrado." }, { status: 404 });
    }
    console.error("[api/reports/scans] query failed", { code });
    return NextResponse.json({ message: "No se pudieron cargar las marcas." }, { status: 500 });
  }
}
