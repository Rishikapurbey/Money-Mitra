import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  hasActiveFilters,
  matchesFilters,
  rangeBounds,
  searchQuery,
  totalsOf,
} from "./transactionFilters";

const with_ = (changes: Partial<typeof DEFAULT_FILTERS>) => ({ ...DEFAULT_FILTERS, ...changes });

describe("filters in the URL", () => {
  it("round-trips and leaves defaults out", () => {
    const filters = with_({ q: "swiggy", type: "expense", min: "500", range: "custom", from: "2026-01-01", to: "2026-03-31" });
    const params = filtersToParams(filters);
    expect(params.has("category")).toBe(false);
    expect(filtersFromParams(params)).toEqual(filters);
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe("");
  });

  it("ignores values it doesn't understand", () => {
    const filters = filtersFromParams(new URLSearchParams("type=gift&range=forever"));
    expect(filters.type).toBe("all");
    expect(filters.range).toBe("month");
  });

  it("knows when any filter is set", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters(with_({ range: "all" }))).toBe(true);
  });
});

describe("rangeBounds", () => {
  const now = new Date(2026, 8, 29); // 29 September 2026
  const september = new Date(2026, 8, 1);

  it("covers the selected month", () => {
    expect(rangeBounds(DEFAULT_FILTERS, new Date(2026, 5, 1), now)).toEqual({ from: new Date(2026, 5, 1), to: new Date(2026, 6, 1) });
  });

  it("covers the last three months including this one", () => {
    expect(rangeBounds(with_({ range: "3m" }), september, now)).toEqual({ from: new Date(2026, 6, 1), to: new Date(2026, 9, 1) });
  });

  it("covers this calendar year", () => {
    expect(rangeBounds(with_({ range: "year" }), september, now)).toEqual({ from: new Date(2026, 0, 1), to: new Date(2027, 0, 1) });
  });

  it("is open-ended for all time", () => {
    expect(rangeBounds(with_({ range: "all" }), september, now)).toEqual({});
  });

  it("includes the whole end day of a custom range, and allows either end to be blank", () => {
    expect(rangeBounds(with_({ range: "custom", from: "2026-02-10", to: "2026-02-20" }), september, now)).toEqual({
      from: new Date(2026, 1, 10),
      to: new Date(2026, 1, 21),
    });
    expect(rangeBounds(with_({ range: "custom", to: "2026-02-20" }), september, now)).toEqual({ to: new Date(2026, 1, 21) });
  });
});

describe("searchQuery", () => {
  it("sends only the filters that are set, and drops invalid amounts", () => {
    const query = searchQuery(with_({ q: "  rent ", type: "expense", min: "abc", max: "2000", range: "all" }), new Date(2026, 8, 1));
    expect(query).toEqual({ q: "rent", type: "expense", max: 2000 });
  });
});

describe("matchesFilters", () => {
  const lunch = { amount: 400, type: "expense", category: "Food", note: "Swiggy lunch" };

  it("searches notes and categories ignoring case", () => {
    expect(matchesFilters(lunch, with_({ q: "SWIGGY" }))).toBe(true);
    expect(matchesFilters(lunch, with_({ q: "foo" }))).toBe(true);
    expect(matchesFilters(lunch, with_({ q: "zomato" }))).toBe(false);
    expect(matchesFilters({ ...lunch, note: null }, with_({ q: "lunch" }))).toBe(false);
  });

  it("applies type, category and an inclusive amount range", () => {
    expect(matchesFilters(lunch, with_({ type: "income" }))).toBe(false);
    expect(matchesFilters(lunch, with_({ category: "Rent" }))).toBe(false);
    expect(matchesFilters(lunch, with_({ min: "400", max: "400" }))).toBe(true);
    expect(matchesFilters(lunch, with_({ min: "401" }))).toBe(false);
  });
});

describe("totalsOf", () => {
  it("counts and adds up income and spending separately", () => {
    expect(totalsOf([{ amount: 100, type: "expense" }, { amount: 50, type: "expense" }, { amount: 900, type: "income" }])).toEqual({
      count: 3,
      income: 900,
      expense: 150,
    });
  });
});
