import { Link } from "react-router-dom";
import { ArrowRight, Calculator as CalculatorIcon } from "lucide-react";
import { CALCULATORS } from "../lib/calculators";
import { CALCULATOR_ICONS } from "../lib/calculatorIcons";

function Calculators() {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Calculators</h1>
        <p className="mt-1 text-sm text-ink-500">Quick, free tools to plan your money. Results update as you type.</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CALCULATORS.map((c) => {
          const Icon = CALCULATOR_ICONS[c.slug] ?? CalculatorIcon;
          return (
            <li key={c.slug}>
              <Link
                to={`/calculators/${c.slug}`}
                className="h-full flex flex-col bg-surface border border-line rounded-2xl p-5 hover:border-ink-300 transition"
              >
                <span className="inline-flex w-fit bg-brand-50 p-2.5 rounded-xl">
                  <Icon size={20} className="text-brand-600" />
                </span>
                <h2 className="mt-4 font-semibold text-ink-900">{c.name}</h2>
                <p className="mt-1 text-sm text-ink-500 flex-1">{c.short}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                  Open calculator <ArrowRight size={14} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-ink-400 text-center">
        Results are estimates for planning only. They are not guaranteed returns or financial advice.
      </p>
    </main>
  );
}

export default Calculators;
