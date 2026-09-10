"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

import { auditAction, redirectWithError } from "@/lib/actions/utils";
import { requireMaster } from "@/lib/auth/guards";
import { formValues, uuidSchema, workerSchema } from "@/lib/domain/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

function workerInput(formData: FormData) {
  return {
    ...formValues(formData),
    condominiumIds: formData.getAll("condominiumIds"),
  };
}

export async function createWorkerAction(formData: FormData) {
  const context = await requireMaster();
  const parsed = workerSchema.safeParse(workerInput(formData));
  if (!parsed.success || !parsed.data.password) {
    redirectWithError("/master/workers/new", parsed.success ? "La contraseña inicial es obligatoria." : parsed.error.issues[0].message);
  }

  const admin = createAdminClient();
  const existing = await admin.from("profiles").select("id").eq("nickname", parsed.data.nickname).maybeSingle();
  if (existing.error) redirectWithError("/master/workers/new", "No se pudo verificar el nickname.");
  if (existing.data) redirectWithError("/master/workers/new", "Ese nickname no está disponible.");
  const internalAuthEmail = `worker-${randomUUID()}@accounts.tridente.example`;
  const authResult = await admin.auth.admin.createUser({
    email: internalAuthEmail,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (authResult.error || !authResult.data.user) {
    redirectWithError("/master/workers/new", "No se pudo crear la cuenta del trabajador.");
  }

  const workerId = authResult.data.user.id;
  const profile = await admin.from("profiles").insert({
    id: workerId,
    organization_id: context.profile.organization_id,
    role: "worker",
    nickname: parsed.data.nickname,
    full_name: parsed.data.fullName,
    employee_code: parsed.data.employeeCode,
  }).select().single();

  if (profile.error) {
    await admin.auth.admin.deleteUser(workerId);
    redirectWithError("/master/workers/new", profile.error.code === "23505" ? "El nickname o código de empleado ya está en uso." : "No se pudo crear el perfil del trabajador.");
  }

  await auditAction(context, { action: "worker.nickname_assigned", entityType: "worker", entityId: workerId, after: { nickname: parsed.data.nickname } });

  if (parsed.data.condominiumIds.length > 0) {
    const assignments = await admin.from("worker_assignments").insert(
      parsed.data.condominiumIds.map((condominiumId) => ({
        organization_id: context.profile.organization_id,
        worker_id: workerId,
        condominium_id: condominiumId,
        assigned_by: context.user.id,
      })),
    );
    if (assignments.error) {
      await admin.from("profiles").delete().eq("id", workerId);
      await admin.auth.admin.deleteUser(workerId);
      redirectWithError("/master/workers/new", "Las asignaciones no son válidas.");
    }
  }

  await auditAction(context, { action: "worker.create", entityType: "worker", entityId: workerId, after: { full_name: parsed.data.fullName, employee_code: parsed.data.employeeCode, condominium_ids: parsed.data.condominiumIds } });
  revalidatePath("/master");
  redirect("/master/workers");
}

export async function updateWorkerAction(id: string, formData: FormData) {
  const context = await requireMaster();
  if (!uuidSchema.safeParse(id).success) redirectWithError("/master/workers", "Identificador inválido.");
  const parsed = workerSchema.safeParse({ ...workerInput(formData), id, password: undefined });
  if (!parsed.success) redirectWithError(`/master/workers/${id}/edit`, parsed.error.issues[0].message);

  const admin = createAdminClient();
  const before = await admin.from("profiles").select("*").eq("id", id).eq("organization_id", context.profile.organization_id).eq("role", "worker").single();
  if (!before.data) redirectWithError("/master/workers", "Trabajador no encontrado.");

  const existing = await admin.from("profiles").select("id").eq("nickname", parsed.data.nickname).neq("id", id).maybeSingle();
  if (existing.error) redirectWithError(`/master/workers/${id}/edit`, "No se pudo verificar el nickname.");
  if (existing.data) redirectWithError(`/master/workers/${id}/edit`, "Ese nickname no está disponible.");

  const profile = await admin.from("profiles").update({
    nickname: parsed.data.nickname,
    full_name: parsed.data.fullName,
    employee_code: parsed.data.employeeCode,
  }).eq("id", id).eq("organization_id", context.profile.organization_id);
  if (profile.error) redirectWithError(`/master/workers/${id}/edit`, profile.error.code === "23505" ? "El nickname o código de empleado ya está en uso." : "No se pudo actualizar el trabajador.");

  if (before.data.nickname !== parsed.data.nickname) {
    await auditAction(context, { action: "worker.nickname_changed", entityType: "worker", entityId: id, before: { nickname: before.data.nickname }, after: { nickname: parsed.data.nickname } });
  }
  await admin.from("worker_assignments").update({ active: false }).eq("worker_id", id).eq("organization_id", context.profile.organization_id);
  if (parsed.data.condominiumIds.length > 0) {
    const assignments = await admin.from("worker_assignments").upsert(
      parsed.data.condominiumIds.map((condominiumId) => ({
        organization_id: context.profile.organization_id,
        worker_id: id,
        condominium_id: condominiumId,
        assigned_by: context.user.id,
        active: true,
      })),
      { onConflict: "worker_id,condominium_id" },
    );
    if (assignments.error) redirectWithError(`/master/workers/${id}/edit`, "No se pudieron actualizar las asignaciones.");
  }

  await auditAction(context, { action: "worker.update", entityType: "worker", entityId: id, before: before.data, after: { full_name: parsed.data.fullName, employee_code: parsed.data.employeeCode, condominium_ids: parsed.data.condominiumIds } });
  revalidatePath("/master");
  redirect("/master/workers");
}

export async function archiveWorkerAction(id: string) {
  const context = await requireMaster();
  if (!uuidSchema.safeParse(id).success) return;
  const admin = createAdminClient();
  const before = await admin.from("profiles").select("*").eq("id", id).eq("organization_id", context.profile.organization_id).eq("role", "worker").single();
  if (!before.data) return;
  const { error } = await admin.rpc("archive_worker", { p_organization_id: context.profile.organization_id, p_worker_id: id });
  if (error) throw new Error("No se pudo archivar el trabajador.");
  await auditAction(context, { action: "worker.archive", entityType: "worker", entityId: id, before: before.data, after: { active: false } });
  revalidatePath("/master");
}
