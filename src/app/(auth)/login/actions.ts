"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { nicknameSchema } from "@/lib/auth/nickname";
import { createAdminClient } from "@/lib/supabase/admin";

import type { Profile } from "@/lib/auth/types";
import { safeNextPath } from "@/lib/auth/redirects";
import { hasPublicEnv } from "@/lib/env";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import {
  clearLoginAttempts,
  consumeLoginAttempt,
} from "@/lib/security/rate-limit";
import { writeAuditEvent } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  nickname: nicknameSchema,
  password: z.string().min(1).max(128),
});

export type LoginState = { message: string | null };

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!hasPublicEnv()) {
    return { message: "El entorno aun no esta conectado al servicio de acceso." };
  }

  const parsed = credentialsSchema.safeParse({
    nickname: formData.get("nickname"),
    password: formData.get("password"),
  });
  const requestedNext = safeNextPath(formData.get("next")?.toString() ?? null, "");

  if (!parsed.success) {
    return { message: "Revisa el nickname y la contraseña." };
  }

  const requestHeaders = await headers();
  const ip = getClientIp(requestHeaders);
  const userAgent = getUserAgent(requestHeaders);

  let limit: Awaited<ReturnType<typeof consumeLoginAttempt>>;
  try {
    limit = await consumeLoginAttempt(parsed.data.nickname, ip);
  } catch {
    return { message: "El control de acceso no esta disponible. Intenta mas tarde." };
  }

  if (!limit.allowed) {
    return {
      message: limit.configurationError
        ? "El control de acceso no esta disponible. Intenta mas tarde."
        : "Demasiados intentos. Espera 15 minutos antes de reintentar.",
    };
  }

  // Only the server resolves nicknames; never expose a public account lookup.
  const admin = createAdminClient();
  const lookup = await admin.from("profiles").select("id, active")
    .eq("nickname", parsed.data.nickname).maybeSingle();
  if (lookup.error) {
    return { message: "El control de acceso no esta disponible. Intenta mas tarde." };
  }
  const account = lookup.data?.active
    ? await admin.auth.admin.getUserById(lookup.data.id)
    : null;
  // Unknown accounts still go through Auth; all credential failures look alike.
  const email = account?.data.user?.email ?? `missing-${randomUUID()}@invalid.example`;
  const supabase = await createClient();
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password: parsed.data.password });

  if (authError || !authData.user || authData.user.id !== lookup.data?.id) {
    if (authData.user) await supabase.auth.signOut();
    return { message: "Credenciales incorrectas o cuenta inactiva." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, organization_id, role, full_name, employee_code, active")
    .eq("id", authData.user.id)
    .single();
  const profile = data as Profile | null;

  if (error || !profile?.active) {
    await supabase.auth.signOut();
    return { message: "Credenciales incorrectas o cuenta inactiva." };
  }

  await clearLoginAttempts(parsed.data.nickname, ip);
  await writeAuditEvent({
    organizationId: profile.organization_id,
    actorUserId: profile.id,
    action: "auth.login",
    entityType: "session",
    ip,
    userAgent,
  });

  const workerNext = requestedNext.startsWith("/scan") || requestedNext.startsWith("/worker")
    ? requestedNext
    : "/worker";
  redirect(profile.role === "master" ? "/master/condominiums" : workerNext);
}
