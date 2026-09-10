import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "BOOTSTRAP_ORGANIZATION_NAME",
  "BOOTSTRAP_ORGANIZATION_SLUG",
  "BOOTSTRAP_MASTER_NAME",
  "BOOTSTRAP_MASTER_NICKNAME",
  "BOOTSTRAP_MASTER_EMAIL",
  "BOOTSTRAP_MASTER_PASSWORD",
];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  throw new Error(`Faltan variables: ${missing.join(", ")}`);
}
if (process.env.BOOTSTRAP_MASTER_PASSWORD.length < 12) {
  throw new Error("BOOTSTRAP_MASTER_PASSWORD debe tener al menos 12 caracteres.");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const nickname = process.env.BOOTSTRAP_MASTER_NICKNAME.trim().toLowerCase();
if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(nickname)) {
  throw new Error("Nickname inválido: usa entre 3 y 32 letras sin tildes, números, puntos o guiones.");
}
const existing = await supabase.from("profiles").select("id").eq("nickname", nickname).maybeSingle();
if (existing.error) throw new Error("Aplica primero las tres migraciones SQL.");
if (existing.data) throw new Error("El nickname ya está en uso.");

const organization = await supabase.from("organizations").insert({
  name: process.env.BOOTSTRAP_ORGANIZATION_NAME.trim(),
  slug: process.env.BOOTSTRAP_ORGANIZATION_SLUG.trim().toLowerCase(),
}).select().single();
if (organization.error) throw new Error(`No se pudo crear la organización: ${organization.error.message}`);

const auth = await supabase.auth.admin.createUser({
  email: process.env.BOOTSTRAP_MASTER_EMAIL.trim().toLowerCase(),
  password: process.env.BOOTSTRAP_MASTER_PASSWORD,
  email_confirm: true,
});
if (auth.error || !auth.data.user) {
  await supabase.from("organizations").delete().eq("id", organization.data.id);
  throw new Error(`No se pudo crear el usuario: ${auth.error?.message ?? "error desconocido"}`);
}

const profile = await supabase.from("profiles").insert({
  id: auth.data.user.id,
  organization_id: organization.data.id,
  role: "master",
  nickname,
  full_name: process.env.BOOTSTRAP_MASTER_NAME.trim(),
  email: process.env.BOOTSTRAP_MASTER_EMAIL.trim().toLowerCase(),
}).select().single();
if (profile.error) {
  await supabase.auth.admin.deleteUser(auth.data.user.id);
  await supabase.from("organizations").delete().eq("id", organization.data.id);
  throw new Error(`No se pudo crear el perfil: ${profile.error.message}`);
}

console.log("userMaster inicial creado correctamente. Elimina las variables BOOTSTRAP_*.");
