import { describe, expect, it } from "vitest";

import { checkpointSchema, condominiumSchema, incidentReportSchema, scanRequestSchema } from "./schemas";

describe("esquemas operativos", () => {
  it("acepta un condominio con nombre y direccion", () => {
    const result = condominiumSchema.safeParse({
      name: "Condominio Norte",
      address: "San José",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza una sola coordenada", () => {
    const result = checkpointSchema.safeParse({
      condominiumId: "d9428888-122b-11e1-b85c-61cd3cbb3210",
      name: "Portón",
      latitude: "9.9",
      longitude: "",
      radiusMeters: "75",
    });
    expect(result.success).toBe(false);
  });

  it("acepta una marca ligera sin hora del cliente ni datos del navegador", () => {
    expect(scanRequestSchema.safeParse({
      token: "a".repeat(40),
      latitude: 9.9281,
      longitude: -84.0907,
      accuracyMeters: 12,
    }).success).toBe(true);
  });

  it("rechaza una marca con una sola coordenada", () => {
    expect(scanRequestSchema.safeParse({
      token: "a".repeat(40),
      latitude: 9.9281,
      longitude: null,
      accuracyMeters: 12,
    }).success).toBe(false);
  });

  it("acepta una incidencia con condominio, descripción y GPS", () => {
    expect(incidentReportSchema.safeParse({
      condominiumId: "d9428888-122b-11e1-b85c-61cd3cbb3210",
      incidentType: "damage",
      description: "Se encontró una luminaria rota junto al acceso norte.",
      latitude: "9.9281",
      longitude: "-84.0907",
      accuracyMeters: "12",
    }).success).toBe(true);
  });

  it("rechaza incidencias sin ubicación o con descripción insuficiente", () => {
    expect(incidentReportSchema.safeParse({
      condominiumId: "d9428888-122b-11e1-b85c-61cd3cbb3210",
      incidentType: "other",
      description: "Breve",
      latitude: "",
      longitude: "",
      accuracyMeters: "",
    }).success).toBe(false);
  });
});
