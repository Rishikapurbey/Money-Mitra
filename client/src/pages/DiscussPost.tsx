import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { ArrowLeft, Trash2, AlertCircle } from "lucide-react";
import api from "../lib/api";
import { authorName, timeAgo, discussInputClass } from "../lib/discuss";
import type { Post } from "../lib/discuss";

type PostResult = Post | "not-found" | "error";

async function fetchPost(id: string | undefined): Promise<PostResult> {
  try {
    const res = await api.get(`/posts/${id}`);
    return res.data.post;
  } catch (err) {
    return isAxiosError(err) && err.response?.status === 404 ? "not-found" : "error";
  }
}

function DiscussPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [replying, setReplying] = useState(false);

  const applyPost = useCallback((result: PostResult) => {
    if (result === "not-found") setNotFound(true);
    else if (result === "error") setError("We couldn't load this discussion. Check your connection and try again.");
    else {
      setPost(result);
      setError("");
    }
    setLoading(false);
  }, []);

  const loadPost = useCallback(async () => applyPost(await fetchPost(id)), [id, applyPost]);

  // Ignore a response that arrives after the user has already opened another discussion
  useEffect(() => {
    let current = true;
    fetchPost(id).then((result) => current && applyPost(result));
    return () => {
      current = false;
    };
  }, [id, applyPost]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setReplying(true);
    try {
      const res = await api.post(`/posts/${id}/replies`, { body: reply, isAnonymous });
      setPost((current) => current && { ...current, replies: [...(current.replies ?? []), res.data.reply] });
      setReply("");
      setIsAnonymous(false);
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.error) || "We couldn't post your reply. Please try again.");
    } finally {
      setReplying(false);
    }
  };

  const handleDeletePost = async () => {
    try {
      await api.delete(`/posts/${id}`);
      navigate("/discuss");
    } catch {
      setError("We couldn't delete this question. Please try again.");
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    try {
      await api.delete(`/posts/${id}/replies/${replyId}`);
      setPost((current) => current && { ...current, replies: current.replies?.filter((r) => r.id !== replyId) });
    } catch {
      setError("We couldn't delete that reply. Please try again.");
    }
  };

  const backLink = (
    <Link to="/discuss" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition">
      <ArrowLeft size={16} /> All discussions
    </Link>
  );

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4 animate-pulse">
        <div className="h-4 w-32 bg-ink-200 rounded" />
        <div className="h-48 bg-ink-100 rounded-2xl" />
        <div className="h-24 bg-ink-100 rounded-2xl" />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {backLink}
        <div className="bg-surface border border-line rounded-2xl px-5 py-14 text-center">
          <p className="font-medium text-ink-900">This discussion doesn't exist</p>
          <p className="mt-1 text-sm text-ink-500">It may have been deleted by its author.</p>
        </div>
      </main>
    );
  }

  const replies = post?.replies ?? [];

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {backLink}

      {error && (
        <div role="alert" className="flex items-center gap-3 bg-loss-soft text-loss px-4 py-3 rounded-xl text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          {!post && (
            <button onClick={loadPost} className="font-medium underline underline-offset-2 hover:no-underline">
              Retry
            </button>
          )}
        </div>
      )}

      {post && (
        <>
          <article className="bg-surface border border-line rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">{post.topic}</span>
              {post.isMine && (
                <button
                  onClick={handleDeletePost}
                  className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-loss transition"
                >
                  <Trash2 size={15} /> Delete
                </button>
              )}
            </div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-ink-900">{post.title}</h1>
            <p className="mt-1.5 text-xs text-ink-500">
              <span className="font-medium text-ink-700">{authorName(post)}</span> · {timeAgo(post.createdAt)}
            </p>
            {post.body && <p className="mt-4 text-ink-700 leading-relaxed whitespace-pre-line">{post.body}</p>}
          </article>

          <section>
            <h2 className="font-semibold text-ink-900 mb-3">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </h2>
            {replies.length === 0 ? (
              <p className="text-sm text-ink-500">No replies yet. Share what you know.</p>
            ) : (
              <ul className="bg-surface border border-line rounded-2xl divide-y divide-line">
                {replies.map((r) => (
                  <li key={r.id} className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs text-ink-500">
                        <span className="font-medium text-ink-700">{authorName(r)}</span> · {timeAgo(r.createdAt)}
                      </p>
                      {r.isMine && (
                        <button
                          onClick={() => handleDeleteReply(r.id)}
                          aria-label="Delete reply"
                          className="text-ink-300 hover:text-loss transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-ink-700 leading-relaxed whitespace-pre-line">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form onSubmit={handleReply} className="bg-surface border border-line rounded-2xl p-5 space-y-3">
            <textarea
              placeholder="Write a helpful reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={3000}
              rows={3}
              className={`${discussInputClass} resize-y`}
              required
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 accent-brand-600"
                />
                Reply anonymously
              </label>
              <button
                type="submit"
                disabled={replying}
                className="bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60"
              >
                {replying ? "Posting…" : "Post reply"}
              </button>
            </div>
          </form>
        </>
      )}
    </main>
  );
}

export default DiscussPost;
