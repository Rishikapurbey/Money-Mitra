import { TERMS } from "./learn";

export interface Tip {
  slug: string;
  headline: string;
}

export interface TipInput {
  income: number;
  expense: number;
  // This month's expense categories and the user's goal names
  categories: string[];
  goalNames: string[];
  // Terms already read or tips dismissed, so the same one isn't suggested again
  skip: Set<string>;
  // Changes once a day, to rotate the "term of the day"
  dayIndex: number;
}

// Picks the one Learn term most relevant to the user's money right now
export function chooseTip({ income, expense, categories, goalNames, skip, dayIndex }: TipInput): Tip | null {
  const rules: { when: boolean; slug: string; headline: string }[] = [
    {
      when: income > 0 && !goalNames.some((n) => /emergency/i.test(n)),
      slug: "emergency-fund",
      headline: "Do you have an emergency fund? Here's why it matters.",
    },
    {
      when: income > 0 && expense > income,
      slug: "budget",
      headline: "Spent more than you earned? A simple budget can help.",
    },
    {
      when: categories.some((c) => /\b(emi|loan)s?\b/i.test(c)),
      slug: "emi",
      headline: "Paying off a loan? See how EMIs work and how to pay less interest.",
    },
    {
      when: income > 0 && (income - expense) / income >= 0.2,
      slug: "sip",
      headline: "You're saving well. Could your savings work harder?",
    },
  ];

  const match = rules.find((r) => r.when && !skip.has(r.slug));
  if (match) return { slug: match.slug, headline: match.headline };

  // Otherwise a term of the day, skipping ones already read or dismissed
  for (let i = 0; i < TERMS.length; i++) {
    const term = TERMS[(dayIndex + i) % TERMS.length];
    if (!skip.has(term.slug)) return { slug: term.slug, headline: `Term of the day: ${term.term}` };
  }
  return null;
}
