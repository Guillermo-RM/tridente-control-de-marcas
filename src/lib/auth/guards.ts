import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import type { AuthContext, Profile } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, organization_id, role, full_name, employee_code, active")
    .eq("id", user.id)
    .single();

  if (error || !data || !data.active) return null;

  return {
    user: { id: user.id, email: user.email ?? null },
    profile: data as Profile,
  };
});

export async function requireAuthenticated() {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  return context;
}

export async function requireMaster() {
  const context = await requireAuthenticated();
  if (context.profile.role !== "master") redirect("/worker");
  return context;
}

export async function requireWorker() {
  const context = await requireAuthenticated();
  if (context.profile.role !== "worker") redirect("/master/condominiums");
  return context;
}
