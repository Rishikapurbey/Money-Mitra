import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { ArrowLeft, ArrowRight, BookOpen, Trash2, AlertCircle, ThumbsUp, Award, EyeOff, CheckCircle2 } from "lucide-react";
import api from "../lib/api";
import { timeAgo, discussInputClass } from "../lib/discuss";
import type { Post } from "../lib/discuss";
import ReportButton from "../components/ReportButton";
import { pageWidth } from "../lib/ui";
import { useWideLayout } from "../lib/useMediaQuery";
import { TERMS } from "../lib/learn";
import { useToast } from "../lib/toast";
import { useTitle } from "../lib/useTitle";
import { announceNotificationsChange } from "../lib/dataEvents";
import Byline from "../components/Byline";
import type { AppContext } from "../components/AppLayout";

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
  const { me } = useOutletContext<AppContext>();
  // null until the person ticks or unticks it; until then it follows their "anonymous by default" setting
  const [anonymousChoice, setIsAnonymous] = useState<boolean | null>(null);
  const isAnonymous = anonymousChoice ?? me?.anonymousByDefault ?? false;
  const [replying, setReplying] = useState(false);
  // Which item is waiting for delete confirmation: "post", a reply id, or null
  const [confirming, setConfirming] = useState<string | null>(null);
  const wide = useWideLayout();
  const [moreInTopic, setMoreInTopic] = useState<Post[]>([]);
  const toast = useToast();
  const postTopic = post?.topic;
  // Other questions on the same topic, for the side rail
  useEffect(() => {
    if (!postTopic) return;
    let current = true;
    api
      .get("/posts", { params: { topic: postTopic } })
      .then((res) => current && setMoreInTopic((res.data.posts as Post[]).filter((p) => p.id !== id).slice(0, 5)))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [postTopic, id]);
  useTitle(post && !post.hidden ? post.title : "Discuss");

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
    // Opening a discussion counts as reading its notifications
    if (id) api.post(`/notifications/posts/${id}/read`).then(announceNotificationsChange).catch(() => {});
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
      setIsAnonymous(null);
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.error) || "We couldn't post your reply. Please try again.");
    } finally {
      setReplying(false);
    }
  };

  const handleDeletePost = async () => {
    try {
      await api.delete(`/posts/${id}`);
      toast({ message: "Question deleted" });
      navigate("/discuss");
    } catch {
      setError("We couldn't delete this question. Please try again.");
    }
  };

  const handleHelpful = async (replyId: string) => {
    try {
      const res = await api.post(`/posts/${id}/replies/${replyId}/helpful`);
      // Update in place; replies are re-sorted by helpfulness on the next visit, not while reading
      setPost((current) =>
        current && {
          ...current,
          replies: current.replies?.map((r) => (r.id === replyId ? { ...r, ...res.data } : r)),
        }
      );
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.error) || "We couldn't save your vote. Please try again.");
    }
  };

  // The asker marks a reply as the answer, or clears it with null
  const handleAccept = async (replyId: string | null) => {
    try {
      const { acceptedReplyId } = (await api.put(`/posts/${id}/accepted`, { replyId })).data;
      setPost(
        (current) =>
          current && {
            ...current,
            answered: acceptedReplyId !== null,
            replies: current.replies?.map((r) => ({ ...r, accepted: r.id === acceptedReplyId })),
          }
      );
      toast({ message: acceptedReplyId ? "Marked as the answer" : "Answer removed" });
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.error) || "We couldn't update the answer. Please try again.");
    }
  };

  const hideReply = (replyId: string) =>
    setPost((current) =>
      current && {
        ...current,
        replies: current.replies?.map((r) => (r.id === replyId ? { ...r, hidden: true, body: "", author: null, profile: null } : r)),
      }
    );

  const handleDeleteReply = async (replyId: string) => {
    try {
      await api.delete(`/posts/${id}/replies/${replyId}`);
      setPost((current) => current && { ...current, replies: current.replies?.filter((r) => r.id !== replyId) });
      setConfirming(null);
      toast({ message: "Reply deleted" });
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
      <main className={`${pageWidth} py-8`}>
        <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
          <div className="h-4 w-32 bg-ink-200 rounded" />
          <div className="h-48 bg-ink-100 rounded-2xl" />
          <div className="h-24 bg-ink-100 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className={`${pageWidth} py-8`}>
        <div className="max-w-3xl mx-auto space-y-6">
          {backLink}
          <div className="bg-surface border border-line rounded-2xl px-5 py-14 text-center">
            <p className="font-medium text-ink-900">This discussion doesn't exist</p>
            <p className="mt-1 text-sm text-ink-500">It may have been deleted by its author.</p>
          </div>
        </div>
      </main>
    );
  }

  const replies = post?.replies ?? [];
  // "Most helpful" goes on the top reply after the accepted answer, when it has votes
  const mostHelpful = replies.find((r) => !r.accepted && !r.hidden);
  const showMostHelpful = mostHelpful && mostHelpful.helpfulCount > 0 && replies.length > 1 ? mostHelpful.id : null;

  const relatedTerms = post
    ? (TERMS.some((t) => t.topic === post.topic) ? TERMS.filter((t) => t.topic === post.topic) : TERMS.filter((t) => t.level === "Basics")).slice(0, 4)
    : [];

  const sideRail = post && !post.hidden && (
    <aside className="space-y-6 sticky top-20" aria-label="More on this topic">
      <div className="dark-panel bg-ink-900 text-white rounded-2xl p-5">
        <p className="font-semibold">Have a question of your own?</p>
        <p className="mt-1 text-sm text-ink-300">Ask the community. You can post anonymously.</p>
        <Link
          to={`/discuss?ask=1&topic=${encodeURIComponent(post.topic)}`}
          className="mt-4 inline-flex items-center gap-1.5 bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-500 transition"
        >
          Ask a question
        </Link>
      </div>
      {moreInTopic.length > 0 && (
        <section className="bg-surface border border-line rounded-2xl p-5" aria-labelledby="more-title">
          <h2 id="more-title" className="font-semibold text-ink-900">More in {post.topic}</h2>
          <ul className="mt-3 divide-y divide-line">
            {moreInTopic.map((p) => (
              <li key={p.id}>
                <Link to={`/discuss/${p.id}`} className="block py-2.5 group">
                  <span className="block text-sm font-medium text-ink-900 group-hover:text-brand-700 transition line-clamp-2">{p.title}</span>
                  <span className="block mt-0.5 text-xs text-ink-500">
                    {p.replyCount ?? 0} {p.replyCount === 1 ? "reply" : "replies"} · {timeAgo(p.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="bg-surface border border-line rounded-2xl p-5" aria-labelledby="terms-title">
        <h2 id="terms-title" className="flex items-center gap-2 font-semibold text-ink-900">
          <BookOpen size={16} className="text-brand-600" /> Learn more
        </h2>
        <ul className="mt-3 space-y-1">
          {relatedTerms.map((t) => (
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
      <div className={wide ? "grid grid-cols-[minmax(0,1fr)_340px] gap-8 items-start" : "max-w-3xl mx-auto"}>
      <div className="space-y-6 min-w-0">
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

      {post?.hidden && (
        <div className="bg-surface border border-line rounded-2xl px-5 py-14 text-center">
          <EyeOff size={22} className="mx-auto text-ink-400" />
          <p className="mt-3 font-medium text-ink-900">This question has been hidden</p>
          <p className="mt-1 text-sm text-ink-500">It was reported by several members of the community.</p>
        </div>
      )}

      {post && !post.hidden && (
        <>
          <article className="bg-surface border border-line rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">{post.topic}</span>
                {post.answered && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-gain bg-gain-soft px-2 py-0.5 rounded-md">
                    <CheckCircle2 size={13} /> Answered
                  </span>
                )}
              </span>
              {post.isMine &&
                (confirming === "post" ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="text-ink-700">Delete this question and its replies?</span>
                    <button onClick={handleDeletePost} className="font-medium text-loss hover:underline">Delete</button>
                    <button onClick={() => setConfirming(null)} className="text-ink-500 hover:text-ink-900">Cancel</button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirming("post")}
                    className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-loss transition"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                ))}
            </div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-ink-900">{post.title}</h1>
            <p className="mt-1.5 text-xs text-ink-500">
              <Byline item={post} /> · {timeAgo(post.createdAt)}
            </p>
            {post.body && <p className="mt-4 text-ink-700 leading-relaxed whitespace-pre-line">{post.body}</p>}
            {!post.isMine && (
              <div className="mt-4 flex flex-wrap">
                <ReportButton path={`/posts/${post.id}`} onHidden={() => setPost({ ...post, hidden: true })} />
              </div>
            )}
          </article>

          <section>
            <h2 className="font-semibold text-ink-900 mb-3">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </h2>
            {replies.length === 0 ? (
              <p className="text-sm text-ink-500">No replies yet. Share what you know.</p>
            ) : (
              <ul className="bg-surface border border-line rounded-2xl divide-y divide-line">
                {replies.map((r) =>
                  r.hidden ? (
                    <li key={r.id} className="p-5 flex items-center gap-2 text-sm text-ink-400">
                      <EyeOff size={15} /> This reply has been hidden after reports from the community.
                    </li>
                  ) : (
                    <li key={r.id} className={`p-5 ${r.accepted ? "bg-gain-soft/40 first:rounded-t-2xl" : ""}`}>
                      {r.accepted ? (
                        <p className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-gain bg-gain-soft px-2 py-0.5 rounded-md">
                          <CheckCircle2 size={13} /> Accepted answer
                        </p>
                      ) : (
                        showMostHelpful === r.id && (
                          <p className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                            <Award size={13} /> Most helpful
                          </p>
                        )
                      )}
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs text-ink-500">
                          <Byline item={r} /> · {timeAgo(r.createdAt)}
                        </p>
                        {r.isMine &&
                          (confirming === r.id ? (
                            <span className="flex items-center gap-2 text-xs">
                              <span className="text-ink-700">Delete reply?</span>
                              <button onClick={() => handleDeleteReply(r.id)} className="font-medium text-loss hover:underline">
                                Delete
                              </button>
                              <button onClick={() => setConfirming(null)} className="text-ink-500 hover:text-ink-900">
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirming(r.id)}
                              aria-label="Delete reply"
                              className="text-ink-300 hover:text-loss transition"
                            >
                              <Trash2 size={15} />
                            </button>
                          ))}
                      </div>
                      <p className="mt-2 text-ink-700 leading-relaxed whitespace-pre-line">{r.body}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                        {r.isMine ? (
                          r.helpfulCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
                              <ThumbsUp size={13} /> {r.helpfulCount} found this helpful
                            </span>
                          )
                        ) : (
                          <>
                            <button
                              onClick={() => handleHelpful(r.id)}
                              aria-pressed={r.votedByMe}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                                r.votedByMe
                                  ? "border-brand-500 bg-brand-50 text-brand-700"
                                  : "border-line text-ink-500 hover:border-ink-300 hover:text-ink-900"
                              }`}
                            >
                              <ThumbsUp size={13} /> Helpful{r.helpfulCount > 0 && ` · ${r.helpfulCount}`}
                            </button>
                            <ReportButton path={`/posts/${post.id}/replies/${r.id}`} onHidden={() => hideReply(r.id)} />
                          </>
                        )}
                        {post.isMine &&
                          (r.accepted ? (
                            <button onClick={() => handleAccept(null)} className="text-xs font-medium text-ink-500 hover:text-ink-900 transition">
                              Remove as answer
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAccept(r.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-line text-ink-500 hover:border-gain hover:text-gain transition"
                            >
                              <CheckCircle2 size={13} /> Mark as answer
                            </button>
                          ))}
                      </div>
                    </li>
                  )
                )}
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
      </div>
      {wide && sideRail}
      </div>
    </main>
  );
}

export default DiscussPost;
