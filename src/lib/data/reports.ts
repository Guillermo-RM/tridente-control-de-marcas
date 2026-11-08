import "server-only";

import { requireMaster } from "@/lib/auth/guards";
import { decodeReportCursor, encodeReportCursor } from "@/lib/data/report-cursor";
import { uuidSchema } from "@/lib/domain/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export const REPORT_PAGE_SIZE = 50;
export const REPORT_EXPORT_LIMIT = 10_000;

export type ReportFilters = {
  workerId?: string;
  from?: string;
  to?: string;
};

export type ReportScanEvent = {
  id: string;
  scanned_at: string;
  worker_id: string;
  worker_name_snapshot: string;
  checkpoint_id: string;
  checkpoint_name_snapshot: string;
  condominium_id: string;
  ip_address: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  distance_meters: number | null;
  location_status: string;
  condominiums: { name: string } | { name: string }[] | null;
};

function validCalendarDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function reportRange(filters: ReportFilters) {
  const now = new Date();
  const oldest = new Date(now);
  oldest.setUTCMonth(oldest.getUTCMonth() - 6);

  const fromDate = validCalendarDate(filters.from);
  const requestedStart = fromDate
    ? new Date(fromDate.getTime() + 6 * 60 * 60 * 1_000)
    : oldest;
  const start = requestedStart < oldest ? oldest : requestedStart;

  const toDate = validCalendarDate(filters.to);
  const requestedEnd = toDate
    ? new Date(toDate.getTime() + 30 * 60 * 60 * 1_000 - 1)
    : now;
  const end = requestedEnd > now ? now : requestedEnd;

  return { start, end };
}

export async function getReportCondominiums() {
  const context = await requireMaster();
  const admin = createAdminClient();
  const [condominiumsResult, workersResult] = await Promise.all([
    admin
      .from("condominiums")
      .select("id, name")
      .eq("organization_id", context.profile.organization_id)
      .order("name"),
    admin
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", context.profile.organization_id)
      .eq("role", "worker")
      .eq("active", true)
      .order("full_name"),
  ]);

  if (condominiumsResult.error || workersResult.error) {
    throw new Error("No se pudieron cargar los filtros del reporte.");
  }
  return {
    context,
    condominiums: condominiumsResult.data ?? [],
    workers: workersResult.data ?? [],
  };
}

export async function getMasterReportPage(
  organizationId: string,
  condominiumId: string,
  cursor?: string | null,
  filters: ReportFilters = {},
  pageSize = REPORT_PAGE_SIZE,
) {
  if (!uuidSchema.safeParse(condominiumId).success) {
    throw new Error("INVALID_CONDOMINIUM");
  }

  const decodedCursor = cursor ? decodeReportCursor(cursor) : null;
  if (cursor && !decodedCursor) throw new Error("INVALID_CURSOR");

  const admin = createAdminClient();
  const effectivePageSize = Math.min(Math.max(pageSize, 1), REPORT_PAGE_SIZE);
  const { start, end } = reportRange(filters);
  if (filters.workerId && !uuidSchema.safeParse(filters.workerId).success) {
    throw new Error("INVALID_WORKER");
  }
  const condominiumResult = await admin
    .from("condominiums")
    .select("id, name")
    .eq("id", condominiumId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (condominiumResult.error) throw new Error("REPORT_QUERY_FAILED");
  if (!condominiumResult.data) throw new Error("CONDOMINIUM_NOT_FOUND");

  let query = admin.from("scan_events")
    .select("id, scanned_at, worker_id, worker_name_snapshot, checkpoint_id, checkpoint_name_snapshot, condominium_id, ip_address, latitude, longitude, accuracy_meters, distance_meters, location_status, condominiums(name)")
    .eq("organization_id", organizationId)
    .eq("condominium_id", condominiumId)
    .gte("scanned_at", start.toISOString())
    .lte("scanned_at", end.toISOString())
    .order("scanned_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(effectivePageSize + 1);

  if (filters.workerId) query = query.eq("worker_id", filters.workerId);

  if (decodedCursor) {
    query = query.or(
      `scanned_at.lt.${decodedCursor.scannedAt},and(scanned_at.eq.${decodedCursor.scannedAt},id.lt.${decodedCursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error("REPORT_QUERY_FAILED");

  const rows = (data ?? []) as ReportScanEvent[];
  const hasMore = rows.length > effectivePageSize;
  const events = rows.slice(0, effectivePageSize);
  const last = events.at(-1);

  return {
    condominium: condominiumResult.data,
    events,
    nextCursor: hasMore && last
      ? encodeReportCursor({ scannedAt: last.scanned_at, id: last.id })
      : null,
  };
}

export async function getSelectedMasterReportPage(
  condominiumId: string,
  cursor?: string | null,
  filters: ReportFilters = {},
) {
  const context = await requireMaster();
  return getMasterReportPage(
    context.profile.organization_id,
    condominiumId,
    cursor,
    filters,
  );
}

export async function getMasterReportExport(
  organizationId: string,
  condominiumId: string,
  filters: ReportFilters = {},
) {
  if (!uuidSchema.safeParse(condominiumId).success) {
    throw new Error("INVALID_CONDOMINIUM");
  }

  const admin = createAdminClient();
  const { start, end } = reportRange(filters);
  if (filters.workerId && !uuidSchema.safeParse(filters.workerId).success) {
    throw new Error("INVALID_WORKER");
  }
  const { data: condominium, error: condominiumError } = await admin
    .from("condominiums")
    .select("id, name")
    .eq("id", condominiumId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (condominiumError) throw new Error("REPORT_QUERY_FAILED");
  if (!condominium) throw new Error("CONDOMINIUM_NOT_FOUND");

  const events: ReportScanEvent[] = [];
  while (true) {
    let query = admin
      .from("scan_events")
      .select("id, scanned_at, worker_id, worker_name_snapshot, checkpoint_id, checkpoint_name_snapshot, condominium_id, ip_address, latitude, longitude, accuracy_meters, distance_meters, location_status, condominiums(name)")
      .eq("organization_id", organizationId)
      .eq("condominium_id", condominiumId)
      .gte("scanned_at", start.toISOString())
      .lte("scanned_at", end.toISOString())
      .order("scanned_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(Math.min(500, REPORT_EXPORT_LIMIT + 1 - events.length));

    if (filters.workerId) query = query.eq("worker_id", filters.workerId);
    const last = events.at(-1);
    if (last) {
      query = query.or(
        `scanned_at.lt.${last.scanned_at},and(scanned_at.eq.${last.scanned_at},id.lt.${last.id})`,
      );
    }
    const { data, error } = await query;
    if (error) throw new Error("REPORT_QUERY_FAILED");
    if (!data?.length) return { condominium, events, start, end };

    events.push(...(data as ReportScanEvent[]));
    if (events.length > REPORT_EXPORT_LIMIT) throw new Error("REPORT_EXPORT_LIMIT");
  }
}
