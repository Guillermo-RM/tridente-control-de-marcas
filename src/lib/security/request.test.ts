import { describe, expect, it } from "vitest";

import { getClientIp } from "./request";

describe("getClientIp", () => {
  it("prioriza la cabecera de Vercel", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.7",
      "x-vercel-forwarded-for": "203.0.113.10, 10.0.0.1",
    });
    expect(getClientIp(headers)).toBe("203.0.113.10");
  });

  it("no confunde una lista de proxies con una IP", () => {
    const headers = new Headers({ "x-forwarded-for": "192.0.2.1, 10.0.0.2" });
    expect(getClientIp(headers)).toBe("192.0.2.1");
  });
});
