import { describe, expect, it } from "vitest";

import { csvCell, csvRow, safeCsvFileSegment } from "./csv";

describe("CSV export helpers", () => {
  it("keeps numbers numeric and escapes text", () => {
    expect(csvRow([9.9281, "Rotonda \"Norte\"", null]))
      .toBe('9.9281,"Rotonda ""Norte""",');
  });

  it("prevents spreadsheet formulas and multiline records", () => {
    expect(csvCell("  =HYPERLINK(\"bad\")\nnext"))
      .toBe('"\'  =HYPERLINK(""bad"") next"');
  });

  it("creates a safe readable filename segment", () => {
    expect(safeCsvFileSegment("Vista del Valle / San Ramón"))
      .toBe("vista-del-valle-san-ramon");
  });
});
