import { z } from "zod";

const cursorSchema = z.object({
  scannedAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

export type ReportCursor = z.infer<typeof cursorSchema>;

export function encodeReportCursor(cursor: ReportCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeReportCursor(value: string): ReportCursor | null {
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const result = cursorSchema.safeParse(decoded);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
