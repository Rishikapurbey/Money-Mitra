// Below zero shows as "−₹8,450" rather than "₹-8,450"
export const formatINR = (n: number) =>
  (n < 0 ? "−₹" : "₹") + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const inputClass =
  "border border-line bg-surface rounded-xl px-4 py-2.5 text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition";

// Shared page width, so the header and every page line up edge to edge
export const pageWidth = "max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8";
