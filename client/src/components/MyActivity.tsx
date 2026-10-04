import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, EyeOff, MessageCircle, ThumbsUp } from "lucide-react";
import api from "../lib/api";
import { timeAgo } from "../lib/discuss";

interface Activity {
  totals: { questions: number; replies: number; helpful: number; accepted: number };
  questions: {
    id: string;
    title: string;
    topic: string;
    isAnonymous: boolean;
    createdAt: string;
    replyCount: number;
    answered: boolean;
    hidden: boolean;
  }[];
  replies: {
    id: string;
    body: string;
    isAnonymous: boolean;
    createdAt: string;
    postId: string;
    postTitle: string;
    helpfulCount: number;
    accepted: boolean;
    hidden: boolean;
  }[];
}

const tag = "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md";

// The viewer's own questions and replies in Discuss, anonymous ones included, since only they see this
function MyActivity() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<"questions" | "replies">("questions");

  useEffect(() => {
    let current = true;
    api.get("/posts/activity").then(
      (res) => current && setActivity(res.data),
      () => current && setFailed(true)
    );
    return () => {
      current = false;
    };
  }, []);

  if (failed) {
    return <p role="alert" className="text-sm text-loss bg-loss-soft px-4 py-3 rounded-xl">We couldn't load your activity. Please try again.</p>;
  }
  if (!activity) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-24 bg-ink-100 rounded-2xl" />
        <div className="h-32 bg-ink-100 rounded-2xl" />
      </div>
    );
  }

  const { totals } = activity;
  const stats = [
    { label: "Questions", value: totals.questions },
    { label: "Replies", value: totals.replies },
    { label: "Helpful votes", value: totals.helpful },
    { label: "Accepted answers", value: totals.accepted },
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col justify-between bg-surface border border-line rounded-2xl p-4">
            <dt className="text-xs font-medium uppercase tracking-wider text-ink-500">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink-900 tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-ink-500">Only you can see this. It includes anything you posted anonymously.</p>

      <div role="tablist" aria-label="Show my" className="flex gap-2">
        {(["questions", "replies"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
              view === v ? "bg-ink-900 text-surface" : "bg-surface border border-line text-ink-700 hover:border-ink-300"
            }`}
          >
            {v === "questions" ? "My questions" : "My replies"}
          </button>
        ))}
      </div>

      {view === "questions" ? (
        activity.questions.length === 0 ? (
          <div className="bg-surface border border-line rounded-2xl px-5 py-10 text-center text-sm text-ink-500">
            You haven't asked anything yet. No question is too basic.
          </div>
        ) : (
          <ul className="bg-surface border border-line rounded-2xl divide-y divide-line">
            {activity.questions.map((q) => (
              <li key={q.id}>
                <Link to={`/discuss/${q.id}`} className="block p-5 hover:bg-canvas transition first:rounded-t-2xl last:rounded-b-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`${tag} text-brand-700 bg-brand-50`}>{q.topic}</span>
                    {q.answered && (
                      <span className={`${tag} text-gain bg-gain-soft`}>
                        <CheckCircle2 size={13} /> Answered
                      </span>
                    )}
                    {q.isAnonymous && <span className={`${tag} text-ink-500 bg-ink-100`}>Anonymous</span>}
                    {q.hidden && (
                      <span className={`${tag} text-loss bg-loss-soft`}>
                        <EyeOff size={13} /> Hidden after reports
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-medium text-ink-900">{q.title}</p>
                  <p className="mt-1 flex items-center gap-3 text-xs text-ink-500">
                    <span>{timeAgo(q.createdAt)}</span>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={13} /> {q.replyCount} {q.replyCount === 1 ? "reply" : "replies"}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : activity.replies.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl px-5 py-10 text-center text-sm text-ink-500">
          You haven't replied to anyone yet. Know something? Someone is waiting for an answer.
        </div>
      ) : (
        <ul className="bg-surface border border-line rounded-2xl divide-y divide-line">
          {activity.replies.map((r) => (
            <li key={r.id}>
              <Link to={`/discuss/${r.postId}`} className="block p-5 hover:bg-canvas transition first:rounded-t-2xl last:rounded-b-2xl">
                <p className="text-xs text-ink-500 truncate">
                  On <span className="font-medium text-ink-700">{r.postTitle || "a hidden question"}</span> · {timeAgo(r.createdAt)}
                </p>
                <p className="mt-1.5 text-sm text-ink-700 line-clamp-2">{r.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {r.accepted && (
                    <span className={`${tag} text-gain bg-gain-soft`}>
                      <CheckCircle2 size={13} /> Accepted answer
                    </span>
                  )}
                  {r.helpfulCount > 0 && (
                    <span className={`${tag} text-ink-700 bg-ink-100`}>
                      <ThumbsUp size={13} /> {r.helpfulCount} helpful
                    </span>
                  )}
                  {r.isAnonymous && <span className={`${tag} text-ink-500 bg-ink-100`}>Anonymous</span>}
                  {r.hidden && (
                    <span className={`${tag} text-loss bg-loss-soft`}>
                      <EyeOff size={13} /> Hidden after reports
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MyActivity;
