const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

const SERVER_ENV_KEYS = [
  ...PUBLIC_ENV_KEYS,
  "SUPABASE_SERVICE_ROLE_KEY",
  "RATE_LIMIT_HASH_SECRET",
] as const;

type PublicEnvKey = (typeof PUBLIC_ENV_KEYS)[number];
type ServerEnvKey = (typeof SERVER_ENV_KEYS)[number];

function missing(keys: readonly string[]) {
  return keys.filter((key) => !process.env[key]?.trim());
}

export function hasPublicEnv() {
  return missing(PUBLIC_ENV_KEYS).length === 0;
}

export function getPublicEnv(): Record<PublicEnvKey, string> {
  const absent = missing(PUBLIC_ENV_KEYS);

  if (absent.length > 0) {
    throw new Error(`Configuracion publica incompleta: ${absent.join(", ")}`);
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  };
}

export function getServerEnv(): Record<ServerEnvKey, string> {
  const absent = missing(SERVER_ENV_KEYS);

  if (absent.length > 0) {
    throw new Error(`Configuracion de servidor incompleta: ${absent.join(", ")}`);
  }

  return {
    ...getPublicEnv(),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    RATE_LIMIT_HASH_SECRET: process.env.RATE_LIMIT_HASH_SECRET!,
  };
}

export function getQrSigningSecret() {
  const value = process.env.QR_SIGNING_SECRET?.trim();
  if (!value) throw new Error("Configuracion de QR incompleta: QR_SIGNING_SECRET");
  if (value.length < 32) throw new Error("QR_SIGNING_SECRET debe tener al menos 32 caracteres");
  return value;
}
