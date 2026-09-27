// Pure calculation functions for the public calculators. All rates are yearly percentages.

export interface CalculatorInfo {
  slug: string;
  name: string;
  short: string;
  learnSlug: string;
}

export const CALCULATORS: CalculatorInfo[] = [
  { slug: "sip", name: "SIP calculator", short: "See what a monthly investment could grow to.", learnSlug: "sip" },
  { slug: "emi", name: "EMI calculator", short: "Work out your monthly loan payment and total interest.", learnSlug: "emi" },
  { slug: "fd", name: "FD calculator", short: "Find the maturity value of a fixed deposit.", learnSlug: "fixed-deposit" },
  { slug: "inflation", name: "Inflation calculator", short: "See what today's prices could cost in the future.", learnSlug: "inflation" },
  {
    slug: "emergency-fund",
    name: "Emergency fund calculator",
    short: "Find how much to keep aside for unexpected events.",
    learnSlug: "emergency-fund",
  },
];

export const calculatorBySlug = (slug: string) => CALCULATORS.find((c) => c.slug === slug);

// Future value of a monthly SIP, invested at the start of each month and compounded monthly
// (the convention most Indian SIP calculators use). Returns a year-by-year series for charts.
export function sip(monthly: number, annualRatePct: number, years: number) {
  const i = annualRatePct / 100 / 12;
  const valueAfter = (months: number) =>
    i === 0 ? monthly * months : monthly * (((1 + i) ** months - 1) / i) * (1 + i);
  const series = Array.from({ length: years + 1 }, (_, y) => ({
    year: y,
    invested: monthly * 12 * y,
    value: valueAfter(12 * y),
  }));
  const invested = monthly * 12 * years;
  const value = valueAfter(12 * years);
  return { invested, value, gains: value - invested, series };
}

// Equal monthly instalment for a loan (reducing balance)
export function emi(principal: number, annualRatePct: number, years: number) {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  const monthly = r === 0 ? principal / n : (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
  const totalPaid = monthly * n;
  return { monthly, totalPaid, interest: totalPaid - principal };
}

// Fixed deposit maturity, compounded quarterly by default like most Indian banks
export function fd(principal: number, annualRatePct: number, years: number, compoundsPerYear = 4) {
  const maturity = principal * (1 + annualRatePct / 100 / compoundsPerYear) ** (compoundsPerYear * years);
  return { maturity, interest: maturity - principal };
}

// What an amount today would cost after the given years of inflation
export function inflation(amountToday: number, annualRatePct: number, years: number) {
  const future = amountToday * (1 + annualRatePct / 100) ** years;
  // How much today's amount would be worth in future purchasing power
  const purchasingPower = amountToday / (1 + annualRatePct / 100) ** years;
  return { future, purchasingPower };
}

export function emergencyFund(monthlyEssentials: number, months: number, alreadySaved: number) {
  const target = monthlyEssentials * months;
  const gap = Math.max(target - alreadySaved, 0);
  return { target, gap, progress: target > 0 ? Math.min(alreadySaved / target, 1) : 0 };
}
