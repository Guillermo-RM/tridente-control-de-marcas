import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { data, error } = await createAdminClient().rpc("cleanup_scan_history");
  if (error) return Response.json({ ok: false }, { status: 500 });
  return Response.json({ ok: true, deletedScanEvents: data });
}
