import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { MessageCircle, Plus, AlertCircle, MessagesSquare, X } from "lucide-react";
import api from "../lib/api";
import { TOPICS, authorName, timeAgo, discussInputClass } from "../lib/discuss";
import type { Post } from "../lib/discuss";

function Discuss() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [formError, setFormError] = useState("");
  const [posting, setPosting] = useState(false);

  const loadPosts = async () => {
    setError("");
    try {
      const res = await api.get("/posts", { params: topic ? { topic } : {} });
      setPosts(res.data.posts);
    } catch {
      setError("We couldn't load the discussions. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [topic]);

  const closeForm = () => {
    setAsking(false);
    setTitle("");
    setBody("");
    setNewTopic("");
    setIsAnonymous(false);
    setFormError("");
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setPosting(true);
    try {
      const res = await api.post("/posts", { title, body, topic: newTopic, isAnonymous });
      closeForm();
      if (!topic || topic === res.data.post.topic) setPosts((current) => [res.data.post, ...current]);
    } catch (err) {
      setFormError(
        (isAxiosError(err) && err.response?.data?.error) || "We couldn't post your question. Please try again."
      );
    } finally {
      setPosting(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
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

      <div className="bg-ink-900 text-white rounded-2xl p-5 sm:p-6 flex gap-4 items-start">
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

      {asking && (
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
              <span className="block text-sm text-ink-500">Your username won't be shown on this question.</span>
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
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {["", ...TOPICS].map((t) => (
          <button
            key={t || "all"}
            onClick={() => setTopic(t)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              topic === t ? "bg-ink-900 text-white" : "bg-surface border border-line text-ink-700 hover:border-ink-300"
            }`}
          >
            {t || "All topics"}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 bg-loss-soft text-loss px-4 py-3 rounded-xl text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={loadPosts} className="font-medium underline underline-offset-2 hover:no-underline">
            Retry
          </button>
        </div>
      )}

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
          <p className="mt-4 font-medium text-ink-900">{topic ? `No questions in ${topic} yet` : "No questions yet"}</p>
          <p className="mt-1 text-sm text-ink-500">Be the first to ask. Someone else is probably wondering the same thing.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                to={`/discuss/${post.id}`}
                className="block bg-surface border border-line rounded-2xl p-5 hover:border-ink-300 transition"
              >
                <span className="text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">{post.topic}</span>
                <h2 className="mt-2.5 font-semibold text-ink-900">{post.title}</h2>
                {post.body && <p className="mt-1 text-sm text-ink-500 line-clamp-2">{post.body}</p>}
                <div className="mt-3 flex items-center gap-3 text-xs text-ink-500">
                  <span className="font-medium text-ink-700">{authorName(post)}</span>
                  <span>{timeAgo(post.createdAt)}</span>
                  <span className="ml-auto flex items-center gap-1">
                    <MessageCircle size={14} /> {post.replyCount ?? 0} {post.replyCount === 1 ? "reply" : "replies"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default Discuss;
