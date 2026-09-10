"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auditAction, redirectWithError } from "@/lib/actions/utils";
import { requireMaster } from "@/lib/auth/guards";
import { checkpointSchema, formValues, uuidSchema } from "@/lib/domain/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createCheckpointAction(formData: FormData) {
  const context = await requireMaster();
  const requestedCondominiumId = formData.get("condominiumId")?.toString() ?? "";
  const newCheckpointPath = uuidSchema.safeParse(requestedCondominiumId).success
    ? `/master/checkpoints/new?condominiumId=${requestedCondominiumId}`
    : "/master/checkpoints/new";
  const parsed = checkpointSchema.safeParse(formValues(formData));
  if (!parsed.success) redirectWithError(newCheckpointPath, parsed.error.issues[0].message);
  const admin = createAdminClient();
  const condominium = await admin.from("condominiums").select("id").eq("id", parsed.data.condominiumId).eq("organization_id", context.profile.organization_id).eq("active", true).single();
  if (!condominium.data) redirectWithError(newCheckpointPath, "Condominio no válido.");
  const { data, error } = await admin.from("checkpoints").insert({
    organization_id: context.profile.organization_id,
    condominium_id: parsed.data.condominiumId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    latitude: parsed.data.latitude ?? null,
    longitude: parsed.data.longitude ?? null,
    radius_meters: parsed.data.radiusMeters,
    created_by: context.user.id,
  }).select().single();
  if (error) redirectWithError(newCheckpointPath, "No se pudo crear. Revisa que el nombre no esté repetido.");
  await auditAction(context, { action: "checkpoint.create", entityType: "checkpoint", entityId: data.id, after: data });
  revalidatePath("/master");
  revalidatePath(`/master/condominiums/${parsed.data.condominiumId}/checkpoints`);
  redirect(`/master/checkpoints/${data.id}/print`);
}

export async function updateCheckpointAction(id: string, formData: FormData) {
  const context = await requireMaster();
  if (!uuidSchema.safeParse(id).success) redirectWithError("/master/checkpoints", "Identificador inválido.");
  const parsed = checkpointSchema.safeParse({ ...formValues(formData), id });
  if (!parsed.success) redirectWithError(`/master/checkpoints/${id}/edit`, parsed.error.issues[0].message);
  const admin = createAdminClient();
  const before = await admin.from("checkpoints").select("*").eq("id", id).eq("organization_id", context.profile.organization_id).single();
  if (!before.data) redirectWithError("/master/checkpoints", "Punto QR no encontrado.");
  const { data, error } = await admin.from("checkpoints").update({
    condominium_id: parsed.data.condominiumId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    latitude: parsed.data.latitude ?? null,
    longitude: parsed.data.longitude ?? null,
    radius_meters: parsed.data.radiusMeters,
  }).eq("id", id).eq("organization_id", context.profile.organization_id).select().single();
  if (error) redirectWithError(`/master/checkpoints/${id}/edit`, "No se pudo actualizar el punto QR.");
  await auditAction(context, { action: "checkpoint.update", entityType: "checkpoint", entityId: id, before: before.data, after: data });
  revalidatePath("/master");
  revalidatePath(`/master/condominiums/${before.data.condominium_id}/checkpoints`);
  revalidatePath(`/master/condominiums/${data.condominium_id}/checkpoints`);
  redirect(`/master/condominiums/${data.condominium_id}/checkpoints`);
}

export async function archiveCheckpointAction(id: string) {
  const context = await requireMaster();
  if (!uuidSchema.safeParse(id).success) return;
  const admin = createAdminClient();
  const before = await admin.from("checkpoints").select("*").eq("id", id).eq("organization_id", context.profile.organization_id).single();
  if (!before.data) return;
  const { error } = await admin.from("checkpoints").update({ active: false, token_version: before.data.token_version + 1 }).eq("id", id).eq("organization_id", context.profile.organization_id);
  if (error) redirectWithError(`/master/condominiums/${before.data.condominium_id}/checkpoints`, "No se pudo eliminar el punto QR.");
  await auditAction(context, { action: "checkpoint.archive", entityType: "checkpoint", entityId: id, before: before.data, after: { active: false } });
  revalidatePath("/master");
  revalidatePath(`/master/condominiums/${before.data.condominium_id}/checkpoints`);
}

export async function restoreCheckpointAction(id: string) {
  const context = await requireMaster();
  if (!uuidSchema.safeParse(id).success) return;
  const admin = createAdminClient();
  const organizationId = context.profile.organization_id;
  const before = await admin.from("checkpoints").select("*")
    .eq("id", id).eq("organization_id", organizationId).eq("active", false).single();
  if (!before.data) return;

  const condominium = await admin.from("condominiums").select("id")
    .eq("id", before.data.condominium_id).eq("organization_id", organizationId).eq("active", true).single();
  if (!condominium.data) {
    redirectWithError(`/master/condominiums/${before.data.condominium_id}/checkpoints`, "Primero debes restaurar el condominio.");
  }

  const { data, error } = await admin.from("checkpoints").update({ active: true })
    .eq("id", id).eq("organization_id", organizationId).eq("active", false).select().single();
  if (error) redirectWithError(`/master/condominiums/${before.data.condominium_id}/checkpoints`, "No se pudo restaurar el punto QR.");
  await auditAction(context, { action: "checkpoint.restore", entityType: "checkpoint", entityId: id, before: before.data, after: data });
  revalidatePath("/master");
  revalidatePath(`/master/condominiums/${before.data.condominium_id}/checkpoints`);
}

export async function deleteCheckpointAction(id: string) {
  const context = await requireMaster();
  if (!uuidSchema.safeParse(id).success) return;
  const admin = createAdminClient();
  const organizationId = context.profile.organization_id;
  const before = await admin.from("checkpoints").select("*")
    .eq("id", id).eq("organization_id", organizationId).eq("active", false).single();
  if (!before.data) return;
  const checkpointsPath = `/master/condominiums/${before.data.condominium_id}/checkpoints`;

  const scans = await admin.from("scan_events").select("id", { count: "exact", head: true })
    .eq("checkpoint_id", id).eq("organization_id", organizationId);
  if (scans.error) redirectWithError(checkpointsPath, "No se pudo verificar el historial del punto QR.");
  if ((scans.count ?? 0) > 0) {
    redirectWithError(checkpointsPath, "No se puede eliminar permanentemente porque conserva marcas históricas.");
  }

  const deletion = await admin.from("checkpoints").delete()
    .eq("id", id).eq("organization_id", organizationId).eq("active", false).select("id").maybeSingle();
  if (deletion.error || !deletion.data) redirectWithError(checkpointsPath, "No se pudo eliminar permanentemente el punto QR.");
  await auditAction(context, { action: "checkpoint.delete", entityType: "checkpoint", entityId: id, before: before.data, after: null });
  revalidatePath("/master");
  revalidatePath(checkpointsPath);
}

export async function rotateCheckpointTokenAction(id: string) {
  const context = await requireMaster();
  if (!uuidSchema.safeParse(id).success) return;
  const admin = createAdminClient();
  const before = await admin.from("checkpoints").select("*").eq("id", id).eq("organization_id", context.profile.organization_id).eq("active", true).single();
  if (!before.data) return;
  const nextVersion = before.data.token_version + 1;
  await admin.from("checkpoints").update({ token_version: nextVersion }).eq("id", id).eq("organization_id", context.profile.organization_id);
  await auditAction(context, { action: "checkpoint.token_rotate", entityType: "checkpoint", entityId: id, before: { token_version: before.data.token_version }, after: { token_version: nextVersion } });
  revalidatePath(`/master/checkpoints/${id}/print`);
}
