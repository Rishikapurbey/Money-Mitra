import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calculator, Lightbulb, MessageCircle, Info } from "lucide-react";
import { termBySlug, TAX_LAST_REVIEWED } from "../lib/learn";

function LearnTerm() {
  const { slug } = useParams();
  const term = slug ? termBySlug(slug) : undefined;

  const backLink = (
    <Link to="/learn" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition">
      <ArrowLeft size={16} /> All terms
    </Link>
  );

  if (!term) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {backLink}
        <div className="bg-surface border border-line rounded-2xl px-5 py-14 text-center">
          <p className="font-medium text-ink-900">We couldn't find that term</p>
          <p className="mt-1 text-sm text-ink-500">It may have been renamed. Try searching from the Learn page.</p>
        </div>
      </main>
    );
  }

  const signedIn = Boolean(localStorage.getItem("token"));
  const related = term.related.map(termBySlug).filter((t) => t !== undefined);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {backLink}

      <article className="bg-surface border border-line rounded-2xl p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-500">
          {term.level} · {term.topic}
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-ink-900">{term.term}</h1>
        <p className="mt-2 text-lg text-ink-700">{term.short}</p>

        <div className="mt-6 space-y-4 text-ink-700 leading-relaxed">
          {term.explanation.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <section className="mt-6 bg-canvas border border-line rounded-xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Calculator size={16} className="text-brand-600" /> Example
          </h2>
          <p className="mt-2 text-ink-700 leading-relaxed">{term.example}</p>
        </section>

        <section className="mt-4 bg-brand-50 rounded-xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-700">
            <Lightbulb size={16} /> Why it matters to you
          </h2>
          <p className="mt-2 text-ink-700 leading-relaxed">{term.whyItMatters}</p>
        </section>

        {term.topic === "Tax" && (
          <p className="mt-4 flex items-start gap-2 text-sm text-ink-500">
            <Info size={16} className="shrink-0 mt-0.5" />
            Tax rules, rates and limits change with each Budget. Last reviewed {TAX_LAST_REVIEWED}; check the latest rules
            on the Income Tax Department's website before acting.
          </p>
        )}
      </article>

      {related.length > 0 && (
        <section>
          <h2 className="font-semibold text-ink-900 mb-3">Related terms</h2>
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                to={`/learn/${r.slug}`}
                className="px-3.5 py-1.5 rounded-full text-sm bg-surface border border-line text-ink-700 hover:border-brand-500 hover:text-brand-700 transition"
              >
                {r.term}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="bg-ink-900 text-white rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-semibold">Still have a question about {term.term}?</p>
          <p className="mt-1 text-sm text-ink-300">
            {signedIn
              ? "Ask the community. You can post anonymously."
              : "Create a free account to ask the community. You can post anonymously."}
          </p>
        </div>
        <Link
          to={signedIn ? `/discuss?ask=1&topic=${encodeURIComponent(term.topic)}` : "/signup"}
          className="flex items-center gap-1.5 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition"
        >
          <MessageCircle size={16} /> {signedIn ? "Ask in Discuss" : "Get started free"}
        </Link>
      </div>

      <p className="text-xs text-ink-400 text-center">
        For education only, not financial advice. Consider your own situation or a qualified adviser before making decisions.
      </p>
    </main>
  );
}

export default LearnTerm;
