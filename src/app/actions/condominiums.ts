"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auditAction, redirectWithError } from "@/lib/actions/utils";
import { requireMaster } from "@/lib/auth/guards";
import { condominiumSchema, formValues, uuidSchema } from "@/lib/domain/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createCondominiumAction(formData: FormData) {
  const context = await requireMaster();
  const parsed = condominiumSchema.safeParse(formValues(formData));
  if (!parsed.success) redirectWithError("/master/condominiums/new", parsed.error.issues[0].message);

  const admin = createAdminClient();
  const { data, error } = await admin.from("condominiums").insert({
    organization_id: context.profile.organization_id,
    created_by: context.user.id,
    name: parsed.data.name,
    address: parsed.data.address,
  }).select().single();
  if (error) redirectWithError("/master/condominiums/new", "No se pudo crear. Verifica que el nombre no esté repetido.");

  await auditAction(context, { action: "condominium.create", entityType: "condominium", entityId: data.id, after: data });
  revalidatePath("/master");
  redirect("/master/condominiums");
}

export async function updateCondominiumAction(id: string, formData: FormData) {
  const context = await requireMaster();
  if (!uuidSchema.safeParse(id).success) redirectWithError("/master/condominiums", "Identificador inválido.");
  const parsed = condominiumSchema.safeParse({ ...formValues(formData), id });
  if (!parsed.success) redirectWithError(`/master/condominiums/${id}/edit`, parsed.error.issues[0].message);

  const admin = createAdminClient();
  const before = await admin.from("condominiums").select("*").eq("id", id).eq("organization_id", context.profile.organization_id).single();
  if (!before.data) redirectWithError("/master/condominiums", "Condominio no encontrado.");
  const { data, error } = await admin.from("condominiums").update({
    name: parsed.data.name, address: parsed.data.address,
  }).eq("id", id).eq("organization_id", context.profile.organization_id).select().single();
  if (error) redirectWithError(`/master/condominiums/${id}/edit`, "No se pudo guardar el condominio.");

  await auditAction(context, { action: "condominium.update", entityType: "condominium", entityId: id, before: before.data, after: data });
  revalidatePath("/master");
  redirect("/master/condominiums");
}

export async function archiveCondominiumAction(id: string) {
  const context = await requireMaster();
  if (!uuidSchema.safeParse(id).success) return;
  const admin = createAdminClient();
  const before = await admin.from("condominiums").select("*").eq("id", id).eq("organization_id", context.profile.organization_id).single();
  if (!before.data) return;
  const { error } = await admin.rpc("archive_condominium", { p_organization_id: context.profile.organization_id, p_condominium_id: id });
  if (error) throw new Error("No se pudo archivar el condominio.");
  await auditAction(context, { action: "condominium.archive", entityType: "condominium", entityId: id, before: before.data, after: { active: false } });
  revalidatePath("/master");
}

export async function restoreCondominiumAction(id: string) {
  const context = await requireMaster();
  if (!uuidSchema.safeParse(id).success) {
    redirectWithError("/master/condominiums", "Identificador inválido.");
  }

  const admin = createAdminClient();
  const before = await admin.from("condominiums").select("*")
    .eq("id", id)
    .eq("organization_id", context.profile.organization_id)
    .eq("active", false)
    .single();
  if (!before.data) {
    redirectWithError("/master/condominiums", "El condominio archivado no existe.");
  }

  const { data, error } = await admin.from("condominiums")
    .update({ active: true })
    .eq("id", id)
    .eq("organization_id", context.profile.organization_id)
    .eq("active", false)
    .select()
    .single();
  if (error) {
    redirectWithError("/master/condominiums", "No se pudo restaurar el condominio.");
  }

  await auditAction(context, {
    action: "condominium.restore",
    entityType: "condominium",
    entityId: id,
    before: before.data,
    after: data,
  });
  revalidatePath("/master");
  revalidatePath("/master/condominiums");
}

export async function deleteCondominiumAction(id: string) {
  const context = await requireMaster();
  if (!uuidSchema.safeParse(id).success) {
    redirectWithError("/master/condominiums", "Identificador inválido.");
  }

  const admin = createAdminClient();
  const organizationId = context.profile.organization_id;
  const before = await admin.from("condominiums").select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("active", false)
    .single();
  if (!before.data) {
    redirectWithError("/master/condominiums", "Solo se pueden eliminar condominios archivados.");
  }

  const [checkpoints, assignments, scans] = await Promise.all([
    admin.from("checkpoints").select("id", { count: "exact", head: true })
      .eq("condominium_id", id).eq("organization_id", organizationId),
    admin.from("worker_assignments").select("condominium_id", { count: "exact", head: true })
      .eq("condominium_id", id).eq("organization_id", organizationId),
    admin.from("scan_events").select("id", { count: "exact", head: true })
      .eq("condominium_id", id).eq("organization_id", organizationId),
  ]);
  if (checkpoints.error || assignments.error || scans.error) {
    redirectWithError("/master/condominiums", "No se pudo verificar si el condominio puede eliminarse.");
  }
  if (
    (checkpoints.count ?? 0) > 0 ||
    (assignments.count ?? 0) > 0 ||
    (scans.count ?? 0) > 0
  ) {
    redirectWithError(
      "/master/condominiums",
      "No se puede eliminar porque conserva QR, asignaciones o marcas históricas.",
    );
  }

  const deletion = await admin.from("condominiums").delete()
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("active", false)
    .select("id")
    .maybeSingle();
  if (deletion.error) {
    redirectWithError("/master/condominiums", "No se pudo eliminar el condominio.");
  }
  if (!deletion.data) {
    redirectWithError("/master/condominiums", "El condominio ya no está archivado o no existe.");
  }

  await auditAction(context, {
    action: "condominium.delete",
    entityType: "condominium",
    entityId: id,
    before: before.data,
    after: null,
  });
  revalidatePath("/master");
  revalidatePath("/master/condominiums");
}
