import { describe, expect, it } from "vitest";

import { presentLocation } from "./location-presentation";

describe("presentLocation", () => {
  it("distingue GPS registrado sin ubicación configurada en el QR", () => {
    const result = presentLocation("unavailable", 9.9281, -84.0907);

    expect(result.label).toBe("Ubicación registrada");
    expect(result.tone).toBe("captured");
    expect(result.mapUrl).toContain("google.com/maps");
  });

  it("reserva Sin ubicación para marcas sin GPS del dispositivo", () => {
    expect(presentLocation("unavailable", null, null)).toEqual({
      label: "Sin ubicación",
      tone: "unavailable",
      mapUrl: null,
    });
  });
});
