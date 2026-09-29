import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, BookOpen, ChevronRight } from "lucide-react";
import { TERMS, LEVELS, LEARN_TOPICS } from "../lib/learn";
import type { Level } from "../lib/learn";
import { useTitle } from "../lib/useTitle";
import { pageWidth } from "../lib/ui";
import { useWideLayout } from "../lib/useMediaQuery";

const levelStyle: Record<Level, string> = {
  Basics: "text-brand-700 bg-brand-50",
  Intermediate: "text-ink-700 bg-ink-100",
  Advanced: "text-surface bg-ink-800",
};

const chip = (active: boolean) =>
  `px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
    active ? "bg-ink-900 text-surface" : "bg-surface border border-line text-ink-700 hover:border-ink-300"
  }`;

function Learn() {
  useTitle("Learn");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [topic, setTopic] = useState("");
  const wide = useWideLayout();

  const q = query.trim().toLowerCase();
  const results = TERMS.filter((t) => {
    if (level && t.level !== level) return false;
    if (topic && t.topic !== topic) return false;
    if (q && !`${t.term} ${t.short}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const pageHeader = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Learn</h1>
      <p className="mt-1 text-sm text-ink-500">Money terms explained simply, with examples in rupees.</p>
    </div>
  );

  const searchBox = (
    <div className="relative">
      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        placeholder={wide ? "Search terms" : "Search a term, like SIP or credit score"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border border-line bg-surface rounded-xl pl-11 pr-4 py-3 text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
      />
    </div>
  );

  const filterChips = (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
        {["", ...LEVELS].map((l) => (
          <button key={l || "all"} onClick={() => setLevel(l)} className={chip(level === l)}>
            {l || "All levels"}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
        {["", ...LEARN_TOPICS].map((t) => (
          <button key={t || "all"} onClick={() => setTopic(t)} className={chip(topic === t)}>
            {t || "All topics"}
          </button>
        ))}
      </div>
    </div>
  );

  const resultsList = (
    <>
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
        <ul className={`grid gap-3 sm:grid-cols-2 ${wide ? "xl:grid-cols-3 2xl:grid-cols-4" : ""}`}>
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
    </>
  );

  const disclaimer = (
    <p className="text-xs text-ink-400 text-center">
      For education only, not financial advice. Consider your own situation or a qualified adviser before making decisions.
    </p>
  );

  const count = (match: (t: (typeof TERMS)[number]) => boolean) => TERMS.filter(match).length;
  const option = (active: boolean) =>
    `w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition ${
      active ? "bg-surface border border-line font-semibold text-ink-900 shadow-sm" : "text-ink-700 hover:bg-surface"
    }`;

  // Wide screens: search and filters in a panel that stays in view
  const filterPanel = (
    <aside className="sticky top-20 space-y-6" aria-label="Filter terms">
      {searchBox}
      <nav aria-label="Level">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Level</p>
        {["", ...LEVELS].map((l) => (
          <button key={l || "all"} onClick={() => setLevel(l)} aria-current={level === l ? "page" : undefined} className={option(level === l)}>
            {l || "All levels"}
            <span className="text-xs text-ink-400 tabular-nums">{count((t) => !l || t.level === l)}</span>
          </button>
        ))}
      </nav>
      <nav aria-label="Topic">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Topic</p>
        {["", ...LEARN_TOPICS].map((t) => (
          <button key={t || "all"} onClick={() => setTopic(t)} aria-current={topic === t ? "page" : undefined} className={option(topic === t)}>
            {t || "All topics"}
            <span className="text-xs text-ink-400 tabular-nums">{count((term) => !t || term.topic === t)}</span>
          </button>
        ))}
      </nav>
    </aside>
  );

  return (
    <main className={`${pageWidth} py-8`}>
      {wide ? (
        <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-8 items-start">
          {filterPanel}
          <div className="space-y-6 min-w-0">
            <div className="flex items-end justify-between gap-4">
              {pageHeader}
              <p className="text-sm text-ink-500 tabular-nums">
                {results.length} {results.length === 1 ? "term" : "terms"}
              </p>
            </div>
            {resultsList}
            {disclaimer}
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-6">
          {pageHeader}
          {searchBox}
          {filterChips}
          {resultsList}
          {disclaimer}
        </div>
      )}
    </main>
  );
}

export default Learn;
