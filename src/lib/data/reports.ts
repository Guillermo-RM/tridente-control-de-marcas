import "server-only";

import { requireMaster } from "@/lib/auth/guards";
import { uuidSchema } from "@/lib/domain/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function reportRange(from?: string, to?: string) {
  const now = new Date();
  const oldest = new Date(now);
  oldest.setUTCMonth(oldest.getUTCMonth() - 6);
  const defaultFrom = new Date(now);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);
  const requestedFrom = validDate(from) ?? defaultFrom;
  const start = requestedFrom < oldest ? oldest : requestedFrom;
  const requestedTo = validDate(to) ?? now;
  const end = requestedTo > now ? now : requestedTo;
  end.setUTCHours(23, 59, 59, 999);
  return { start, end: end < start ? new Date(start.getTime() + 86_399_999) : end };
}

export async function getMasterReport(filters: { from?: string; to?: string; workerId?: string; condominiumId?: string }, limit = 500) {
  const context = await requireMaster();
  const admin = createAdminClient();
  const { start, end } = reportRange(filters.from, filters.to);
  let query = admin.from("scan_events")
    .select("id, scanned_at, worker_id, worker_name_snapshot, checkpoint_id, checkpoint_name_snapshot, condominium_id, ip_address, latitude, longitude, accuracy_meters, distance_meters, location_status, condominiums(name)")
    .eq("organization_id", context.profile.organization_id)
    .gte("scanned_at", start.toISOString())
    .lte("scanned_at", end.toISOString())
    .order("scanned_at", { ascending: false })
    .limit(limit);
  if (uuidSchema.safeParse(filters.workerId).success) query = query.eq("worker_id", filters.workerId!);
  if (uuidSchema.safeParse(filters.condominiumId).success) query = query.eq("condominium_id", filters.condominiumId!);
  const [events, workers, condominiums] = await Promise.all([
    query,
    admin.from("profiles").select("id, full_name").eq("organization_id", context.profile.organization_id).eq("role", "worker").order("full_name"),
    admin.from("condominiums").select("id, name").eq("organization_id", context.profile.organization_id).order("name"),
  ]);
  if (events.error) throw new Error("No se pudo cargar el reporte.");
  return { context, events: events.data, workers: workers.data ?? [], condominiums: condominiums.data ?? [], start, end };
}
