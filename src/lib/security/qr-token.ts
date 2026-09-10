import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { getQrSigningSecret } from "@/lib/env";

const payloadSchema = z.object({
  checkpointId: z.uuid(),
  version: z.number().int().positive(),
});

function signature(value: string) {
  return createHmac("sha256", getQrSigningSecret())
    .update(value)
    .digest("base64url");
}

export function createQrToken(checkpointId: string, version: number) {
  const payload = Buffer.from(
    JSON.stringify({ checkpointId, version }),
    "utf8",
  ).toString("base64url");
  return `tc1.${payload}.${signature(payload)}`;
}

export function verifyQrToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "tc1") return null;

  const expected = Buffer.from(signature(parts[1]), "utf8");
  const received = Buffer.from(parts[2], "utf8");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    return payloadSchema.parse(
      JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")),
    );
  } catch {
    return null;
  }
}
