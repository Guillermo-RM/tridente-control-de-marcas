import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ RATE_LIMIT_HASH_SECRET: "secret-only-for-incident-share-tests" }),
}));

import { signIncidentShare, verifyIncidentShare } from "./incident-share";

const id = "7e3058d0-cc62-4eb7-892f-82fe0f901b23";
const organizationId = "42f10f0f-f3d9-49d3-aad2-1cfb769e8d25";
const now = Date.UTC(2026, 10, 8);

describe("incident sharing", () => {
  it("allows the exact signed report without a time limit", () => {
    const token = signIncidentShare(id, organizationId);
    expect(verifyIncidentShare(token, now)).toEqual({ id, organizationId });
    expect(verifyIncidentShare(token, Date.UTC(2100, 0, 1))).toEqual({ id, organizationId });
  });

  it("retains the original expiration of a legacy link", () => {
    const payload = `v1.${id}.${organizationId}.${now / 1000 + 86_400}`;
    const mac = createHmac("sha256", "secret-only-for-incident-share-tests")
      .update(`tridente:incident-share:${payload}`).digest("base64url");
    const token = `${payload}.${mac}`;
    expect(verifyIncidentShare(token, now + 86_399_000)).toEqual({ id, organizationId });
    expect(verifyIncidentShare(token, now + 86_400_000)).toBeNull();
  });

  it("rejects altered reports, organizations and signatures", () => {
    const token = signIncidentShare(id, organizationId);
    const parts = token.split(".");
    for (const index of [1, 2, 3]) {
      const changed = [...parts];
      changed[index] = index === 3 ? "A".repeat(43) : "11111111-1111-4111-8111-111111111111";
      expect(verifyIncidentShare(changed.join("."), now)).toBeNull();
    }
    expect(verifyIncidentShare(id, now)).toBeNull();
  });
});
