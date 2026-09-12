import "server-only";

import { createHmac } from "node:crypto";

import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;

function bucketKey(email: string, ip: string) {
  const { RATE_LIMIT_HASH_SECRET } = getServerEnv();
  return createHmac("sha256", RATE_LIMIT_HASH_SECRET)
    .update(`${email.trim().toLowerCase()}|${ip}`)
    .digest("hex");
}

function actionBucketKey(action: string, actorId: string, ip: string) {
  const { RATE_LIMIT_HASH_SECRET } = getServerEnv();
  return createHmac("sha256", RATE_LIMIT_HASH_SECRET)
    .update(`${action}|${actorId}|${ip}`)
    .digest("hex");
}

export async function consumeLoginAttempt(email: string, ip: string) {
  const key = bucketKey(email, ip);
  const { data, error } = await createAdminClient().rpc(
    "consume_auth_rate_limit",
    {
      p_bucket_key: key,
      p_max_attempts: MAX_LOGIN_ATTEMPTS,
      p_window_seconds: LOGIN_WINDOW_SECONDS,
      p_block_seconds: LOGIN_WINDOW_SECONDS,
    },
  );

  if (error || typeof data !== "boolean") {
    return { allowed: false as const, configurationError: true as const };
  }

  return { allowed: data, configurationError: false as const };
}

export async function clearLoginAttempts(email: string, ip: string) {
  const key = bucketKey(email, ip);
  await createAdminClient().rpc("clear_auth_rate_limit", { p_bucket_key: key });
}

export async function consumeIncidentAttempt(actorId: string, ip: string) {
  const { data, error } = await createAdminClient().rpc("consume_auth_rate_limit", {
    p_bucket_key: actionBucketKey("incident", actorId, ip),
    p_max_attempts: 10,
    p_window_seconds: 10 * 60,
    p_block_seconds: 10 * 60,
  });

  return !error && data === true;
}
