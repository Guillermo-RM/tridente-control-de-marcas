import { describe, expect, it } from "vitest";

import { classifyLocation, distanceMeters } from "./distance";

describe("distanceMeters", () => {
  it("calcula una distancia geografica razonable", () => {
    const distance = distanceMeters(
      { latitude: 9.9281, longitude: -84.0907 },
      { latitude: 9.9291, longitude: -84.0907 },
    );
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });

  it("clasifica una lectura sin coordenadas", () => {
    expect(
      classifyLocation(
        { latitude: 9.9, longitude: -84.1, radius_meters: 75 },
        { latitude: null, longitude: null, accuracyMeters: null },
      ),
    ).toEqual({ status: "unavailable", distance: null });
  });
});
