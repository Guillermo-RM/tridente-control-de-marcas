import { z } from "zod";

const cursorSchema = z.object({
  reportedAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

type IncidentCursor = z.infer<typeof cursorSchema>;

export function encodeIncidentCursor(cursor: IncidentCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeIncidentCursor(value: string): IncidentCursor | null {
  try {
    const result = cursorSchema.safeParse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
