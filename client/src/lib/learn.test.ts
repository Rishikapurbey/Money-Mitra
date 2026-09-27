import { describe, expect, it } from "vitest";
import { TERMS } from "./learn";

describe("Learn content", () => {
  it("has unique slugs", () => {
    const slugs = TERMS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only links to terms that exist", () => {
    const slugs = new Set(TERMS.map((t) => t.slug));
    for (const term of TERMS) {
      for (const related of term.related) expect(slugs, `${term.slug} -> ${related}`).toContain(related);
    }
  });

  it("gives every term an explanation and an example", () => {
    for (const term of TERMS) {
      expect(term.explanation.length, term.slug).toBeGreaterThan(0);
      expect(term.example, term.slug).not.toBe("");
    }
  });
});
