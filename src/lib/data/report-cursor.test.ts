import { describe, expect, it } from "vitest";

import { decodeReportCursor, encodeReportCursor } from "./report-cursor";

describe("report cursor", () => {
  it("round-trips a valid cursor", () => {
    const cursor = {
      scannedAt: "2026-09-10T20:41:00.000Z",
      id: "37015e5a-6a40-4c94-88aa-e3d08c810e85",
    };

    expect(decodeReportCursor(encodeReportCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed and tampered cursors", () => {
    expect(decodeReportCursor("not-a-cursor")).toBeNull();
    expect(
      decodeReportCursor(
        Buffer.from(JSON.stringify({ scannedAt: "bad", id: "bad" })).toString("base64url"),
      ),
    ).toBeNull();
  });
});
