import { getAuthContext } from "@/lib/auth/guards";
import { incidentPhoto } from "@/lib/data/incident-detail";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthContext();
  if (!context || context.profile.role !== "master") {
    return new Response(null, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }
  return incidentPhoto((await params).id, context.profile.organization_id);
}
