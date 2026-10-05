import { describe, expect, it } from "vitest";
import { isAppPath } from "./returnTo";

describe("isAppPath", () => {
  it("accepts addresses inside the app and rejects others", () => {
    expect(isAppPath("/join/abc123")).toBe(true);
    expect(isAppPath("/shared?x=1")).toBe(true);
    expect(isAppPath("//evil.example")).toBe(false);
    expect(isAppPath("/\\evil.example")).toBe(false);
    expect(isAppPath("https://evil.example")).toBe(false);
    expect(isAppPath("")).toBe(false);
  });
});
