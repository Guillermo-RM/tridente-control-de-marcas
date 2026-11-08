import { incidentPhoto } from "@/lib/data/incident-detail";
import { verifyIncidentShare } from "@/lib/security/incident-share";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const share = verifyIncidentShare((await params).token);
  if (!share) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return incidentPhoto(share.id, share.organizationId);
}
