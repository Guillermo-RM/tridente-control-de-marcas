import "server-only";

import { requireMaster, requireWorker } from "@/lib/auth/guards";
import type { AuthContext } from "@/lib/auth/types";
import { decodeIncidentCursor, encodeIncidentCursor } from "@/lib/data/incident-cursor";
import { incidentStatusSchema, uuidSchema } from "@/lib/domain/schemas";
import type { IncidentStatus, IncidentType } from "@/lib/domain/incidents";
import { createAdminClient } from "@/lib/supabase/admin";

export const INCIDENT_PAGE_SIZE = 50;

export async function getUnreadIncidentCount(context: AuthContext) {
  if (context.profile.role !== "master") return 0;
  const { data, error } = await createAdminClient().rpc("count_unread_incident_reports", {
    p_master_id: context.user.id,
    p_organization_id: context.profile.organization_id,
  });
  if (error) {
    // Keep the application usable while a new database migration is being
    // deployed or while PostgREST refreshes its schema cache.
    if (error.code !== "PGRST202") {
      console.error("[incidents] unread count failed", error.code);
    }
    return 0;
  }
  return Math.max(0, Number(data) || 0);
}

export type IncidentNotification = {
  condominiumId: string;
  condominiumName: string;
  id: string;
  reportedAt: string;
  workerId: string;
  workerName: string;
};

export async function getRecentUnreadIncidentNotifications(context: AuthContext) {
  if (context.profile.role !== "master") return [];
  const admin = createAdminClient();
  const recent = await admin.from("incident_reports")
    .select("id, condominium_id, worker_id, worker_name_snapshot, condominium_name_snapshot, reported_at")
    .eq("organization_id", context.profile.organization_id)
    .order("reported_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (recent.error) throw new Error("No se pudieron consultar las incidencias nuevas.");

  const rows = recent.data ?? [];
  if (rows.length === 0) return [];
  const viewed = await admin.from("incident_report_views")
    .select("incident_id")
    .eq("organization_id", context.profile.organization_id)
    .eq("master_user_id", context.user.id)
    .in("incident_id", rows.map((row) => row.id));
  if (viewed.error) throw new Error("No se pudieron consultar las incidencias nuevas.");

  const viewedIds = new Set((viewed.data ?? []).map((row) => row.incident_id));
  return rows
    .filter((row) => !viewedIds.has(row.id))
    .slice(0, 50)
    .map((row): IncidentNotification => ({
      condominiumId: row.condominium_id,
      condominiumName: row.condominium_name_snapshot,
      id: row.id,
      reportedAt: row.reported_at,
      workerId: row.worker_id,
      workerName: row.worker_name_snapshot,
    }));
}

export type IncidentFilters = {
  condominiumId?: string;
  workerId?: string;
  status?: IncidentStatus;
  from?: string;
  to?: string;
};

export type IncidentReport = {
  id: string;
  condominium_id: string;
  worker_id: string;
  worker_name_snapshot: string;
  condominium_name_snapshot: string;
  incident_type: IncidentType;
  description: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  status: IncidentStatus;
  reported_at: string;
  is_unread: boolean;
};

function validCalendarDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

export async function getWorkerIncidentFormData() {
  const context = await requireWorker();
  const admin = createAdminClient();
  const assignments = await admin.from("worker_assignments")
    .select("condominium_id")
    .eq("organization_id", context.profile.organization_id)
    .eq("worker_id", context.user.id)
    .eq("active", true);
  if (assignments.error) throw new Error("No se pudieron cargar tus condominios.");

  const ids = (assignments.data ?? []).map((item) => item.condominium_id);
  const condominiums = ids.length
    ? await admin.from("condominiums").select("id, name")
      .eq("organization_id", context.profile.organization_id)
      .eq("active", true)
      .in("id", ids)
      .order("name")
    : { data: [], error: null };
  if (condominiums.error) throw new Error("No se pudieron cargar tus condominios.");
  return { condominiums: condominiums.data ?? [] };
}

export async function getIncidentFacets() {
  const context = await requireMaster();
  const admin = createAdminClient();
  const organizationId = context.profile.organization_id;
  const [condominiums, workers] = await Promise.all([
    admin.from("condominiums").select("id, name").eq("organization_id", organizationId).order("name"),
    admin.from("profiles").select("id, full_name").eq("organization_id", organizationId).eq("role", "worker").order("full_name"),
  ]);
  if (condominiums.error || workers.error) throw new Error("No se pudieron cargar los filtros.");
  return { context, condominiums: condominiums.data ?? [], workers: workers.data ?? [] };
}

export async function getMasterIncidentPage(
  organizationId: string,
  masterUserId: string,
  cursor?: string | null,
  filters: IncidentFilters = {},
) {
  const decoded = cursor ? decodeIncidentCursor(cursor) : null;
  if (cursor && !decoded) throw new Error("INVALID_CURSOR");
  if (filters.condominiumId && !uuidSchema.safeParse(filters.condominiumId).success) throw new Error("INVALID_CONDOMINIUM");
  if (filters.workerId && !uuidSchema.safeParse(filters.workerId).success) throw new Error("INVALID_WORKER");
  if (filters.status && !incidentStatusSchema.safeParse(filters.status).success) throw new Error("INVALID_STATUS");

  const admin = createAdminClient();
  let query = admin.from("incident_reports")
    .select("id, condominium_id, worker_id, worker_name_snapshot, condominium_name_snapshot, incident_type, description, latitude, longitude, accuracy_meters, status, reported_at")
    .eq("organization_id", organizationId)
    .order("reported_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(INCIDENT_PAGE_SIZE + 1);

  if (filters.condominiumId) query = query.eq("condominium_id", filters.condominiumId);
  if (filters.workerId) query = query.eq("worker_id", filters.workerId);
  if (filters.status) query = query.eq("status", filters.status);

  const from = validCalendarDate(filters.from);
  if (from) query = query.gte("reported_at", new Date(from.getTime() + 6 * 60 * 60 * 1000).toISOString());
  const to = validCalendarDate(filters.to);
  if (to) query = query.lte("reported_at", new Date(to.getTime() + 30 * 60 * 60 * 1000 - 1).toISOString());
  if (decoded) {
    query = query.or(`reported_at.lt.${decoded.reportedAt},and(reported_at.eq.${decoded.reportedAt},id.lt.${decoded.id})`);
  }

  const { data, error } = await query;
  if (error) throw new Error("INCIDENT_QUERY_FAILED");
  const rows = (data ?? []) as Omit<IncidentReport, "is_unread">[];
  const hasMore = rows.length > INCIDENT_PAGE_SIZE;
  const pageRows = rows.slice(0, INCIDENT_PAGE_SIZE);
  const ids = pageRows.map((item) => item.id);
  const viewed = ids.length
    ? await admin.from("incident_report_views")
      .select("incident_id")
      .eq("organization_id", organizationId)
      .eq("master_user_id", masterUserId)
      .in("incident_id", ids)
    : { data: [], error: null };
  if (viewed.error) throw new Error("INCIDENT_VIEWS_QUERY_FAILED");
  const viewedIds = new Set((viewed.data ?? []).map((item) => item.incident_id));
  const incidents = pageRows.map((item) => ({ ...item, is_unread: !viewedIds.has(item.id) }));
  const last = incidents.at(-1);
  return {
    incidents,
    nextCursor: hasMore && last
      ? encodeIncidentCursor({ reportedAt: last.reported_at, id: last.id })
      : null,
  };
}
