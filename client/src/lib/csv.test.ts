import { describe, expect, it } from "vitest";
import { csvField } from "./csv";

describe("csvField", () => {
  it("neutralises spreadsheet formulas", () => {
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField("+cmd")).toBe("'+cmd");
    expect(csvField("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("quotes commas and keeps plain values unchanged", () => {
    expect(csvField("Lunch, with team")).toBe('"Lunch, with team"');
    expect(csvField("Food")).toBe("Food");
    expect(csvField(250.5)).toBe("250.5");
    expect(csvField(null)).toBe("");
  });
});
