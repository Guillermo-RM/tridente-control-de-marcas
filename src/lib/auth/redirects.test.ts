import { describe, expect, it } from "vitest";

import { safeNextPath } from "./redirects";

describe("safeNextPath", () => {
  it("permite rutas internas", () => {
    expect(safeNextPath("/master?tab=users")).toBe("/master?tab=users");
  });

  it.each([null, "https://evil.test", "//evil.test", "/%2f%2fevil.test", "/\\evil"])(
    "rechaza redirecciones externas: %s",
    (candidate) => {
      expect(safeNextPath(candidate, "/login")).toBe("/login");
    },
  );
});
