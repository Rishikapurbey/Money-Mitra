import { describe, expect, it } from "vitest";
import { emergencyFund, emi, fd, inflation, sip } from "./calculators";

// Expected values match widely used Indian calculators (e.g. Groww's SIP calculator)
describe("calculators", () => {
  it("SIP: ₹5,000 a month at 12% for 10 years", () => {
    const r = sip(5000, 12, 10);
    expect(Math.round(r.value)).toBe(1161695);
    expect(r.invested).toBe(600000);
    expect(Math.round(r.series[r.series.length - 1].value)).toBe(1161695);
  });

  it("EMI: ₹5 lakh at 10% for 5 years", () => {
    const r = emi(500000, 10, 5);
    expect(Math.round(r.monthly)).toBe(10624);
    expect(Math.round(r.interest)).toBe(137411);
  });

  it("FD: ₹1 lakh at 7% for 3 years, compounded quarterly", () => {
    expect(Math.round(fd(100000, 7, 3).maturity)).toBe(123144);
  });

  it("inflation: ₹100 at 6% for 10 years", () => {
    expect(inflation(100, 6, 10).future).toBeCloseTo(179.08, 2);
  });

  it("handles a 0% rate without dividing by zero", () => {
    expect(sip(1000, 0, 2).value).toBe(24000);
    expect(emi(120000, 0, 1).monthly).toBe(10000);
  });

  it("emergency fund gap never goes below zero", () => {
    expect(emergencyFund(30000, 6, 50000)).toMatchObject({ target: 180000, gap: 130000 });
    expect(emergencyFund(10000, 3, 50000).gap).toBe(0);
  });
});
