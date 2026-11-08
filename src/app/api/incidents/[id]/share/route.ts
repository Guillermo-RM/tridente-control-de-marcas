import { getAuthContext } from "@/lib/auth/guards";
import { getIncidentDetail } from "@/lib/data/incident-detail";
import { signIncidentShare } from "@/lib/security/incident-share";
import { hasSameOrigin } from "@/lib/security/request";

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthContext();
  if (!context || context.profile.role !== "master" || !hasSameOrigin(request.headers)) {
    return Response.json({ message: "Acceso no autorizado." }, { status: 403, headers });
  }
  const { id } = await params;
  const organizationId = context.profile.organization_id;
  try {
    if (!await getIncidentDetail(id, organizationId)) {
      return Response.json({ message: "Incidencia no encontrada." }, { status: 404, headers });
    }
    return Response.json({ path: `/incidencias/compartida/${signIncidentShare(id, organizationId)}` }, { headers });
  } catch {
    return Response.json({ message: "No se pudo generar el enlace." }, { status: 500, headers });
  }
}
