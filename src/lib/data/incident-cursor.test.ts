import { describe, expect, it } from "vitest";

import { decodeIncidentCursor, encodeIncidentCursor } from "./incident-cursor";

describe("incident cursor", () => {
  it("round-trips a valid cursor", () => {
    const cursor = {
      reportedAt: "2026-09-12T18:00:00.000Z",
      id: "37015e5a-6a40-4c94-88aa-e3d08c810e85",
    };
    expect(decodeIncidentCursor(encodeIncidentCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed cursors", () => {
    expect(decodeIncidentCursor("invalid")).toBeNull();
  });
});
