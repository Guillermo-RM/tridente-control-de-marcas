import QRCode from "qrcode";
import { expect, it, vi } from "vitest";

const { getAuthContext, getIncidentDetail, downloadIncidentPhoto } = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  getIncidentDetail: vi.fn(),
  downloadIncidentPhoto: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ getAuthContext }));
vi.mock("@/lib/data/incident-detail", () => ({ getIncidentDetail, downloadIncidentPhoto }));

import { GET } from "@/app/api/incidents/[id]/pdf/route";

const id = "86b86a29-d511-4dd3-a613-ff6b0a0052cb";
const request = new Request(`http://localhost/api/incidents/${id}/pdf`);
const params = Promise.resolve({ id });

it("exports the scoped report with an embedded image and blocks workers", async () => {
  getAuthContext.mockResolvedValueOnce({ profile: { role: "worker" } });
  expect((await GET(request, { params })).status).toBe(403);
  expect(getIncidentDetail).not.toHaveBeenCalled();

  getAuthContext.mockResolvedValueOnce({ profile: { role: "master", organization_id: "org-a" } });
  getIncidentDetail.mockResolvedValueOnce({
    id,
    condominium_name_snapshot: "Condominio de prueba",
    worker_name_snapshot: "José Núñez",
    reported_at: "2026-11-08T16:20:00Z",
    incident_type: "lighting",
    status: "pending",
    latitude: 9.93,
    longitude: -84.08,
    accuracy_meters: 15,
    description: "Se observó una luminaria apagada cerca de la entrada principal. ".repeat(29),
  });
  const png = await QRCode.toBuffer("Evidencia ficticia");
  downloadIncidentPhoto.mockResolvedValueOnce(new Blob([new Uint8Array(png)], { type: "image/png" }));
  const response = await GET(request, { params });
  expect(getIncidentDetail).toHaveBeenCalledWith(id, "org-a");
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toBe(`attachment; filename="incidencia-${id}.pdf"`);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  const pdf = Buffer.from(await response.arrayBuffer()).toString("latin1");
  expect(pdf.startsWith("%PDF-")).toBe(true);
  expect(pdf).toContain("/Subtype /Image");
  expect(pdf.match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
});
