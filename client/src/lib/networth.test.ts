import { describe, expect, it } from "vitest";
import { signedINR, typeLabel, worthINR } from "./networth";

describe("net worth formatting", () => {
  it("shows changes with a sign and values below zero with a minus", () => {
    expect(signedINR(18000)).toBe("+₹18,000");
    expect(signedINR(-2500)).toBe("−₹2,500");
    expect(worthINR(240000)).toBe("₹2,40,000");
    expect(worthINR(-150000)).toBe("−₹1,50,000");
  });

  it("names each type, falling back to Other", () => {
    expect(typeLabel("asset", "retirement")).toBe("PF, PPF or NPS");
    expect(typeLabel("liability", "credit_card")).toBe("Credit card");
    expect(typeLabel("asset", "spaceship")).toBe("Other");
  });
});
