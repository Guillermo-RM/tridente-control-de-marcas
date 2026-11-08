import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthContext, from } = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guards", () => ({ getAuthContext }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));

import { GET as getCsv } from "@/app/api/reports/scans.csv/route";
import { GET as getPdf } from "@/app/api/reports/scans.pdf/route";

const condominiumId = "7c446ebc-d827-480f-993f-592f17be2de4";
const workerId = "7e3058d0-cc62-4eb7-892f-82fe0f901b23";
const request = new Request(`http://localhost/api/reports/export?condominiumId=${condominiumId}&workerId=${workerId}`);

function mockRows(total: number, apiLimit = 500) {
  const scannedAt = new Date().toISOString();
  const rows = Array.from({ length: total }, (_, index) => ({
    id: String(total - index).padStart(5, "0"),
    scanned_at: scannedAt,
    worker_name_snapshot: "José Núñez",
    checkpoint_name_snapshot: "Puesto de recepción",
    condominiums: { name: "Valle Esmeralda" },
    location_status: "unavailable",
    latitude: null,
    longitude: null,
  }));
  from.mockImplementation((table: string) => {
    let limit = apiLimit;
    let cursorId: string | undefined;
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      gte: vi.fn(() => query),
      lte: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn((size: number) => { limit = Math.min(size, apiLimit); return query; }),
      or: vi.fn((condition: string) => { cursorId = /id\.lt\.(\d+)\)$/.exec(condition)?.[1]; return query; }),
      maybeSingle: async () => ({ data: { name: "Valle Esmeralda" }, error: null }),
      then: (resolve: (result: { data: typeof rows; error: null }) => void) => {
        resolve({ data: rows.filter((row) => !cursorId || row.id < cursorId).slice(0, limit), error: null });
      },
    };
    expect(["condominiums", "scan_events"]).toContain(table);
    return query;
  });
}

describe("report downloads", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAuthContext.mockResolvedValue({ profile: { role: "master", organization_id: "organization" } });
  });

  it("exports all 1,101 rows despite a lower API cap and emits a paginated PDF", async () => {
    mockRows(1101, 200);
    const csv = await getCsv(request);
    expect(csv.status).toBe(200);
    expect((await csv.text()).split("\r\n")).toHaveLength(1102);

    const pdf = await getPdf(request);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("Content-Type")).toBe("application/pdf");
    expect(pdf.headers.get("Content-Disposition")).toContain(".pdf");
    const source = Buffer.from(await pdf.arrayBuffer()).toString("latin1");
    expect(source.startsWith("%PDF-")).toBe(true);
    expect(source.match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
  });

  it("rejects an oversized report instead of downloading a partial export", async () => {
    mockRows(10_001);
    expect((await getCsv(request)).status).toBe(422);
  });

  it("denies unauthenticated users and workers before querying data", async () => {
    getAuthContext.mockResolvedValueOnce(null);
    expect((await getPdf(request)).status).toBe(401);
    getAuthContext.mockResolvedValueOnce({ profile: { role: "worker" } });
    expect((await getCsv(request)).status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });

  it("returns 404 when the condominium is outside the administrator's organization", async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: async () => ({ data: null, error: null }),
    };
    from.mockReturnValue(query);
    expect((await getPdf(request)).status).toBe(404);
    expect(query.eq).toHaveBeenCalledWith("organization_id", "organization");
    expect(from).toHaveBeenCalledTimes(1);
  });
});
