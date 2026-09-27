import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, BookOpen, ChevronRight } from "lucide-react";
import { TERMS, LEVELS, LEARN_TOPICS } from "../lib/learn";
import type { Level } from "../lib/learn";

const levelStyle: Record<Level, string> = {
  Basics: "text-brand-700 bg-brand-50",
  Intermediate: "text-ink-700 bg-ink-100",
  Advanced: "text-white bg-ink-800",
};

const chip = (active: boolean) =>
  `px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
    active ? "bg-ink-900 text-white" : "bg-surface border border-line text-ink-700 hover:border-ink-300"
  }`;

function Learn() {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [topic, setTopic] = useState("");

  const q = query.trim().toLowerCase();
  const results = TERMS.filter((t) => {
    if (level && t.level !== level) return false;
    if (topic && t.topic !== topic) return false;
    if (q && !`${t.term} ${t.short}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Learn</h1>
        <p className="mt-1 text-sm text-ink-500">Money terms explained simply, with examples in rupees.</p>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          placeholder="Search a term, like SIP or credit score"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border border-line bg-surface rounded-xl pl-11 pr-4 py-3 text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
        />
      </div>

      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {["", ...LEVELS].map((l) => (
            <button key={l || "all"} onClick={() => setLevel(l)} className={chip(level === l)}>
              {l || "All levels"}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {["", ...LEARN_TOPICS].map((t) => (
            <button key={t || "all"} onClick={() => setTopic(t)} className={chip(topic === t)}>
              {t || "All topics"}
            </button>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl px-5 py-14 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center">
            <BookOpen size={22} className="text-brand-600" />
          </div>
          <p className="mt-4 font-medium text-ink-900">No terms match your search</p>
          <p className="mt-1 text-sm text-ink-500">
            Can't find what you need?{" "}
            <Link
              to={localStorage.getItem("token") ? "/discuss?ask=1" : "/signup"}
              className="text-brand-600 font-medium hover:text-brand-700"
            >
              Ask in Discuss
            </Link>
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {results.map((t) => (
            <li key={t.slug}>
              <Link
                to={`/learn/${t.slug}`}
                className="h-full flex flex-col bg-surface border border-line rounded-2xl p-5 hover:border-ink-300 transition"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${levelStyle[t.level]}`}>{t.level}</span>
                  <span className="text-xs text-ink-500">{t.topic}</span>
                </div>
                <h2 className="mt-2.5 font-semibold text-ink-900">{t.term}</h2>
                <p className="mt-1 text-sm text-ink-500 flex-1">{t.short}</p>
                <span className="mt-3 flex items-center gap-1 text-sm font-medium text-brand-600">
                  Read more <ChevronRight size={16} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-ink-400 text-center">
        For education only, not financial advice. Consider your own situation or a qualified adviser before making decisions.
      </p>
    </main>
  );
}

export default Learn;
