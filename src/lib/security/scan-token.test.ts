import { describe, expect, it } from "vitest";

import { extractScanToken } from "./scan-token";

describe("extractScanToken", () => {
  it("acepta un token directo", () => expect(extractScanToken("tc1.payload.signature")).toBe("tc1.payload.signature"));
  it("extrae el token de una URL", () => expect(extractScanToken("https://control.test/scan?token=tc1.abc.xyz")).toBe("tc1.abc.xyz"));
  it("rechaza texto cualquiera", () => expect(extractScanToken("zona norte")).toBeNull());
});
