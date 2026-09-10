import "server-only";

import { requireMaster } from "@/lib/auth/guards";
import { uuidSchema } from "@/lib/domain/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

function searchableName(value: string) {
  return value.trim().slice(0, 120).replace(/[\\%_]/g, "\\$&");
}

export async function getCondominiumsList(search = "") {
  const context = await requireMaster();
  const admin = createAdminClient();
  let query = admin.from("condominiums")
    .select("*")
    .eq("organization_id", context.profile.organization_id)
    .order("active", { ascending: false })
    .order("name");
  const term = searchableName(search);
  if (term) query = query.ilike("name", `%${term}%`);
  const result = await query;
  if (result.error) throw new Error("No se pudieron cargar los condominios.");
  return { context, condominiums: result.data };
}

export async function getWorkersList(search = "") {
  const context = await requireMaster();
  const admin = createAdminClient();
  let query = admin.from("profiles")
    .select("*")
    .eq("organization_id", context.profile.organization_id)
    .eq("role", "worker")
    .order("active", { ascending: false })
    .order("full_name");
  const term = searchableName(search);
  if (term) query = query.ilike("full_name", `%${term}%`);
  const result = await query;
  if (result.error) throw new Error("No se pudieron cargar los trabajadores.");
  return { context, workers: result.data };
}

export async function getMasterData() {
  const context = await requireMaster();
  const admin = createAdminClient();
  const organizationId = context.profile.organization_id;

  const [condominiums, workers, checkpoints] = await Promise.all([
    admin.from("condominiums").select("*").eq("organization_id", organizationId).order("active", { ascending: false }).order("name"),
    admin.from("profiles").select("*").eq("organization_id", organizationId).eq("role", "worker").order("active", { ascending: false }).order("full_name"),
    admin.from("checkpoints").select("*, condominiums(name)").eq("organization_id", organizationId).order("active", { ascending: false }).order("name"),
  ]);

  if (condominiums.error || workers.error || checkpoints.error) {
    throw new Error("No se pudieron cargar los datos operativos.");
  }

  return {
    context,
    condominiums: condominiums.data,
    workers: workers.data,
    checkpoints: checkpoints.data,
  };
}

export async function getCondominium(id: string) {
  const context = await requireMaster();
  const result = await createAdminClient().from("condominiums").select("*")
    .eq("id", id).eq("organization_id", context.profile.organization_id).single();
  return { context, condominium: result.data };
}

export async function getCondominiumWorkspace(id: string) {
  const context = await requireMaster();
  if (!uuidSchema.safeParse(id).success) {
    return { context, condominium: null, checkpoints: [], workers: [], events: [] };
  }

  const admin = createAdminClient();
  const organizationId = context.profile.organization_id;
  const condominium = await admin.from("condominiums")
    .select("id, name, address, active")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (condominium.error) throw new Error("No se pudo cargar el condominio.");
  if (!condominium.data) {
    return { context, condominium: null, checkpoints: [], workers: [], events: [] };
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6);
  const [checkpoints, assignments, events] = await Promise.all([
    admin.from("checkpoints")
      .select("id, name, description, radius_meters, token_version, active")
      .eq("organization_id", organizationId)
      .eq("condominium_id", id)
      .order("active", { ascending: false })
      .order("name"),
    admin.from("worker_assignments")
      .select("worker_id, assigned_at")
      .eq("organization_id", organizationId)
      .eq("condominium_id", id)
      .eq("active", true),
    admin.from("scan_events")
      .select("id, worker_id, worker_name_snapshot, checkpoint_name_snapshot, scanned_at, location_status")
      .eq("organization_id", organizationId)
      .eq("condominium_id", id)
      .gte("scanned_at", sixMonthsAgo.toISOString())
      .order("scanned_at", { ascending: false })
      .limit(500),
  ]);

  if (checkpoints.error || assignments.error || events.error) {
    throw new Error("No se pudo cargar la operación del condominio.");
  }

  const workerIds = [...new Set((assignments.data ?? []).map((item) => item.worker_id))];
  const workers = workerIds.length > 0
    ? await admin.from("profiles")
      .select("id, full_name, nickname, employee_code, active")
      .eq("organization_id", organizationId)
      .eq("role", "worker")
      .in("id", workerIds)
      .order("active", { ascending: false })
      .order("full_name")
    : { data: [], error: null };

  if (workers.error) throw new Error("No se pudieron cargar los trabajadores asignados.");

  return {
    context,
    condominium: condominium.data,
    checkpoints: checkpoints.data ?? [],
    workers: workers.data ?? [],
    events: events.data ?? [],
  };
}

export async function getWorker(id: string) {
  const context = await requireMaster();
  const admin = createAdminClient();
  const organizationId = context.profile.organization_id;
  const [worker, assignments, condominiums] = await Promise.all([
    admin.from("profiles").select("*").eq("id", id).eq("organization_id", organizationId).eq("role", "worker").single(),
    admin.from("worker_assignments").select("condominium_id").eq("worker_id", id).eq("active", true),
    admin.from("condominiums").select("id, name, active").eq("organization_id", organizationId).eq("active", true).order("name"),
  ]);
  return { context, worker: worker.data, assignments: assignments.data ?? [], condominiums: condominiums.data ?? [] };
}

export async function getCheckpoint(id: string) {
  const context = await requireMaster();
  const admin = createAdminClient();
  const organizationId = context.profile.organization_id;
  const [checkpoint, condominiums] = await Promise.all([
    admin.from("checkpoints").select("*, condominiums(name, address)").eq("id", id).eq("organization_id", organizationId).single(),
    admin.from("condominiums").select("id, name").eq("organization_id", organizationId).eq("active", true).order("name"),
  ]);
  return { context, checkpoint: checkpoint.data, condominiums: condominiums.data ?? [] };
}
