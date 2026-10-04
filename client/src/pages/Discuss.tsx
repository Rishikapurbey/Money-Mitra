import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { MessageCircle, Plus, AlertCircle, MessagesSquare, X, BookOpen, ArrowRight, Search, CheckCircle2 } from "lucide-react";
import api from "../lib/api";
import { TOPICS, timeAgo, discussInputClass } from "../lib/discuss";
import type { Post } from "../lib/discuss";
import { useTitle } from "../lib/useTitle";
import { useToast } from "../lib/toast";
import { pageWidth } from "../lib/ui";
import { useWideLayout } from "../lib/useMediaQuery";
import { TERMS } from "../lib/learn";
import Byline from "../components/Byline";
import MyActivity from "../components/MyActivity";
import type { AppContext } from "../components/AppLayout";

type Feed = "everyone" | "following" | "mine";

async function fetchPosts(topic: string, unanswered: boolean, following = false, q = ""): Promise<Post[] | null> {
  try {
    const res = await api.get("/posts", {
      params: {
        ...(topic && { topic }),
        ...(unanswered && { unanswered: "1" }),
        ...(following && { following: "1" }),
        ...(q && { q }),
      },
    });
    return res.data.posts;
  } catch {
    return null;
  }
}

function Discuss() {
  useTitle("Discuss");
  const toast = useToast();
  // Links from Learn open the ask form with a topic already chosen: /discuss?ask=1&topic=Tax
  const [searchParams] = useSearchParams();
  const presetTopic = TOPICS.includes(searchParams.get("topic") ?? "") ? searchParams.get("topic")! : "";
  const [posts, setPosts] = useState<Post[]>([]);
  const [topic, setTopic] = useState("");
  const [unanswered, setUnanswered] = useState(false);
  // Everyone's questions, only those from people you follow, or your own activity
  const [feed, setFeed] = useState<Feed>(() => {
    const value = searchParams.get("feed");
    return value === "following" || value === "mine" ? value : "everyone";
  });
  const following = feed === "following";
  // What's typed in the search box, and the search actually run after a pause in typing
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(searchParams.get("ask") === "1");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [newTopic, setNewTopic] = useState(presetTopic);
  const { me } = useOutletContext<AppContext>();
  // null until the person ticks or unticks it; until then it follows their "anonymous by default" setting
  const [anonymousChoice, setIsAnonymous] = useState<boolean | null>(null);
  const isAnonymous = anonymousChoice ?? me?.anonymousByDefault ?? false;
  const [formError, setFormError] = useState("");
  const [posting, setPosting] = useState(false);
  const wide = useWideLayout();
  // Unanswered questions for the side rail, independent of the filters
  const [waiting, setWaiting] = useState<Post[]>([]);

  useEffect(() => {
    let current = true;
    fetchPosts("", true).then((result) => current && result && setWaiting(result.slice(0, 5)));
    return () => {
      current = false;
    };
  }, []);

  const applyPosts = useCallback((result: Post[] | null) => {
    if (result) {
      setPosts(result);
      setError("");
    } else {
      setError("We couldn't load the discussions. Check your connection and try again.");
    }
    setLoading(false);
  }, []);

  const loadPosts = useCallback(
    async () => applyPosts(await fetchPosts(topic, unanswered, following, q)),
    [topic, unanswered, following, q, applyPosts]
  );

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Ignore a response that arrives after the user has already changed the filters
  useEffect(() => {
    if (feed === "mine") return;
    let current = true;
    fetchPosts(topic, unanswered, following, q).then((result) => current && applyPosts(result));
    return () => {
      current = false;
    };
  }, [topic, unanswered, following, q, feed, applyPosts]);

  // Picking a topic from your own activity goes back to everyone's questions
  const chooseTopic = (t: string) => {
    setTopic(t);
    if (feed === "mine") setFeed("everyone");
  };

  const closeForm = () => {
    setAsking(false);
    setTitle("");
    setBody("");
    setNewTopic("");
    setIsAnonymous(null);
    setFormError("");
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setPosting(true);
    try {
      const res = await api.post("/posts", { title, body, topic: newTopic, isAnonymous });
      closeForm();
      if (feed === "everyone" && !q && (!topic || topic === res.data.post.topic)) setPosts((current) => [res.data.post, ...current]);
      toast({ message: "Question posted" });
    } catch (err) {
      setFormError(
        (isAxiosError(err) && err.response?.data?.error) || "We couldn't post your question. Please try again."
      );
    } finally {
      setPosting(false);
    }
  };

  const pageHeader = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Discuss</h1>
        <p className="mt-1 text-sm text-ink-500">Ask the community anything about money.</p>
      </div>
      {!asking && (
        <button
          onClick={() => setAsking(true)}
          className="flex items-center gap-1.5 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition"
        >
          <Plus size={16} /> Ask a question
        </button>
      )}
    </div>
  );

  const feedSwitch = (
    <div role="tablist" aria-label="Show" className="inline-grid grid-cols-3 p-1 bg-ink-100 rounded-xl text-sm font-medium">
      {(
        [
          { value: "everyone", label: "Everyone" },
          { value: "following", label: "Following" },
          { value: "mine", label: "My activity" },
        ] as const
      ).map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={feed === option.value}
          onClick={() => setFeed(option.value)}
          className={`px-3 sm:px-5 py-1.5 rounded-lg whitespace-nowrap transition ${
            feed === option.value ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const welcomeBanner = (
    <div className="dark-panel bg-ink-900 text-white rounded-2xl p-5 sm:p-6 flex gap-4 items-start">
      <span className="bg-ink-800 p-2.5 rounded-xl shrink-0">
        <MessagesSquare size={20} className="text-brand-300" />
      </span>
      <div>
        <p className="font-semibold">No question is too basic.</p>
        <p className="mt-1 text-sm text-ink-300">
          Everyone starts somewhere. Post anonymously if you prefer, and your name won't be shown to anyone.
        </p>
      </div>
    </div>
  );

  const askForm = asking && (
    <form onSubmit={handleAsk} className="bg-surface p-6 rounded-2xl border border-brand-500 ring-2 ring-brand-100 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink-900">Ask a question</h2>
        <button type="button" onClick={closeForm} aria-label="Close" className="text-ink-400 hover:text-ink-900 transition">
          <X size={18} />
        </button>
      </div>
      {formError && <p className="text-loss text-sm bg-loss-soft px-3 py-2 rounded-lg">{formError}</p>}
      <input
        type="text"
        placeholder="Your question, in one line (at least 5 characters)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        minLength={5}
        maxLength={150}
        className={discussInputClass}
        required
      />
      <textarea
        placeholder="Add details (optional): your situation, what you've tried, what you're unsure about"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        rows={5}
        className={`${discussInputClass} resize-y`}
      />
      <div>
        <p className="text-sm font-medium text-ink-700 mb-2">Topic</p>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setNewTopic(t)}
              className={`px-3 py-1 rounded-full text-sm border transition ${
                newTopic === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink-700 hover:border-ink-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-brand-600"
        />
        <span>
          <span className="block text-sm font-medium text-ink-900">Post anonymously</span>
          <span className="block text-sm text-ink-500">Your name and photo won't be shown on this question.</span>
        </span>
      </label>
      <button
        type="submit"
        disabled={posting || !newTopic}
        className="bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {posting ? "Posting…" : "Post question"}
      </button>
    </form>
  );

  const topicChips = (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
      {["", ...TOPICS].map((t) => (
        <button
          key={t || "all"}
          onClick={() => chooseTopic(t)}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
            topic === t ? "bg-ink-900 text-surface" : "bg-surface border border-line text-ink-700 hover:border-ink-300"
          }`}
        >
          {t || "All topics"}
        </button>
      ))}
      <span className="w-px shrink-0 bg-line mx-1" aria-hidden="true" />
      <button
        onClick={() => setUnanswered((u) => !u)}
        aria-pressed={unanswered}
        className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
          unanswered ? "bg-brand-600 text-white" : "bg-surface border border-line text-ink-700 hover:border-ink-300"
        }`}
      >
        Unanswered
      </button>
    </div>
  );

  const searchBox = (
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        maxLength={100}
        placeholder="Search questions and replies"
        aria-label="Search questions and replies"
        className={`${discussInputClass} !pl-10 !pr-10 [&::-webkit-search-cancel-button]:appearance-none`}
      />
      {search && (
        <button
          onClick={() => setSearch("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-900 transition"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );

  const errorBanner = error && (
    <div role="alert" className="flex items-center gap-3 bg-loss-soft text-loss px-4 py-3 rounded-xl text-sm">
      <AlertCircle size={18} className="shrink-0" />
      <span className="flex-1">{error}</span>
      <button onClick={loadPosts} className="font-medium underline underline-offset-2 hover:no-underline">
        Retry
      </button>
    </div>
  );

  const list = (
    <>
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 bg-ink-100 rounded-2xl" />
          ))}
        </div>
      ) : posts.length === 0 && !error ? (
        <div className="bg-surface border border-line rounded-2xl px-5 py-14 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center">
            <MessageCircle size={22} className="text-brand-600" />
          </div>
          <p className="mt-4 font-medium text-ink-900">
            {q
              ? `No questions match “${q}”`
              : following
              ? "Nothing from people you follow yet"
              : unanswered
              ? "Every question has an answer"
              : topic
                ? `No questions in ${topic} yet`
                : "No questions yet"}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {q
              ? "Try other words, or ask it yourself. Someone else is probably wondering the same thing."
              : following
              ? "Open someone's profile by tapping their name, then follow them to see their questions here."
              : unanswered
              ? "Nice work, community. Check back later to help someone new."
              : "Be the first to ask. Someone else is probably wondering the same thing."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id}>
              {/* The title's link stretches over the whole card; the author's name links to their profile */}
              <article className="relative bg-surface border border-line rounded-2xl p-5 hover:border-ink-300 transition">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">{post.topic}</span>
                  {post.answered && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gain bg-gain-soft px-2 py-0.5 rounded-md">
                      <CheckCircle2 size={13} /> Answered
                    </span>
                  )}
                </div>
                <h2 className="mt-2.5 font-semibold text-ink-900">
                  <Link to={`/discuss/${post.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
                    {post.title}
                  </Link>
                </h2>
                {post.body && <p className="mt-1 text-sm text-ink-500 line-clamp-2">{post.body}</p>}
                <div className="mt-3 flex items-center gap-3 text-xs text-ink-500">
                  <Byline item={post} />
                  <span>{timeAgo(post.createdAt)}</span>
                  <span className="ml-auto flex items-center gap-1">
                    <MessageCircle size={14} /> {post.replyCount ?? 0} {post.replyCount === 1 ? "reply" : "replies"}
                  </span>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  // Wide screens only: topics as a list on the left
  const topicNav = (
    <nav aria-label="Topics" className="sticky top-20 space-y-1">
      <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Topics</p>
      {["", ...TOPICS].map((t) => (
        <button
          key={t || "all"}
          onClick={() => chooseTopic(t)}
          aria-current={topic === t ? "page" : undefined}
          className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${
            topic === t ? "bg-surface border border-line font-semibold text-ink-900 shadow-sm" : "text-ink-700 hover:bg-surface"
          }`}
        >
          {t || "All topics"}
        </button>
      ))}
      <div className="pt-3 mt-3 border-t border-line">
        <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm text-ink-700 cursor-pointer hover:bg-surface">
          Unanswered only
          <input type="checkbox" checked={unanswered} onChange={(e) => setUnanswered(e.target.checked)} className="w-4 h-4 accent-brand-600" />
        </label>
      </div>
    </nav>
  );

  // Terms to read, following the selected topic when Learn covers it
  const suggestedTerms = (TERMS.some((t) => t.topic === topic) ? TERMS.filter((t) => t.topic === topic) : TERMS.filter((t) => t.level === "Basics")).slice(0, 4);

  const sideRail = (
    <aside className="space-y-6" aria-label="Help others and learn">
      {welcomeBanner}
      {waiting.length > 0 && (
        <section className="bg-surface border border-line rounded-2xl p-5" aria-labelledby="waiting-title">
          <h2 id="waiting-title" className="font-semibold text-ink-900">Waiting for an answer</h2>
          <p className="mt-0.5 text-xs text-ink-500">Know something? Help someone out.</p>
          <ul className="mt-3 divide-y divide-line">
            {waiting.map((post) => (
              <li key={post.id}>
                <Link to={`/discuss/${post.id}`} className="block py-2.5 group">
                  <span className="block text-sm font-medium text-ink-900 group-hover:text-brand-700 transition line-clamp-2">{post.title}</span>
                  <span className="block mt-0.5 text-xs text-ink-500">{post.topic} · {timeAgo(post.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="bg-surface border border-line rounded-2xl p-5" aria-labelledby="learn-title">
        <h2 id="learn-title" className="flex items-center gap-2 font-semibold text-ink-900">
          <BookOpen size={16} className="text-brand-600" /> {topic && TERMS.some((t) => t.topic === topic) ? `Learn about ${topic}` : "Learn the basics"}
        </h2>
        <ul className="mt-3 space-y-1">
          {suggestedTerms.map((t) => (
            <li key={t.slug}>
              <Link to={`/learn/${t.slug}`} className="flex items-center justify-between gap-2 py-1.5 text-sm text-ink-700 hover:text-brand-700 transition">
                {t.term} <ArrowRight size={14} className="shrink-0 text-ink-300" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );

  return (
    <main className={`${pageWidth} py-8`}>
      {wide ? (
        <div className="grid grid-cols-[220px_minmax(0,1fr)_320px] gap-8 items-start">
          {topicNav}
          <div className="space-y-6 min-w-0">
            {pageHeader}
            {askForm}
            {feedSwitch}
            {feed === "mine" ? (
              <MyActivity />
            ) : (
              <>
                {searchBox}
                {errorBanner}
                {list}
              </>
            )}
          </div>
          {sideRail}
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-6">
          {pageHeader}
          {welcomeBanner}
          {askForm}
          {feedSwitch}
          {feed === "mine" ? (
            <MyActivity />
          ) : (
            <>
              {searchBox}
              {topicChips}
              {errorBanner}
              {list}
            </>
          )}
        </div>
      )}
    </main>
  );
}

export default Discuss;
