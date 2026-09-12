import { describe, expect, it } from "vitest";

import { costaRicaCsvDateTime, formatCostaRicaDateTime } from "./costa-rica-date";

describe("formatCostaRicaDateTime", () => {
  it("formats an afternoon timestamp in Costa Rica without Intl differences", () => {
    expect(formatCostaRicaDateTime("2026-09-10T20:41:00.000Z"))
      .toBe("10 sept 2026, 2:41 p. m.");
  });

  it("formats midnight using a 12-hour clock", () => {
    expect(formatCostaRicaDateTime("2026-09-10T06:05:00.000Z"))
      .toBe("10 sept 2026, 12:05 a. m.");
  });

  it("handles invalid values", () => {
    expect(formatCostaRicaDateTime("invalid")).toBe("Fecha no disponible");
    expect(costaRicaCsvDateTime("invalid")).toEqual({ date: "", time: "" });
  });

  it("returns sortable local date and time values for CSV", () => {
    expect(costaRicaCsvDateTime("2026-09-10T20:41:07.000Z"))
      .toEqual({ date: "2026-09-10", time: "14:41:07" });
  });
});
