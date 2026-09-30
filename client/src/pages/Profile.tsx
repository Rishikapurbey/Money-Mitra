import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { CalendarDays, Lock, MessageCircle, Pencil, ThumbsUp, UserPlus, UserRound } from "lucide-react";
import api from "../lib/api";
import { nameOf } from "../lib/me";
import type { Profile as ProfileData } from "../lib/profile";
import { timeAgo } from "../lib/discuss";
import { pageWidth } from "../lib/ui";
import { useTitle } from "../lib/useTitle";
import { useWideLayout } from "../lib/useMediaQuery";
import Avatar from "../components/Avatar";
import FollowButton from "../components/FollowButton";

type Result = ProfileData | "not-found" | "error";

async function fetchProfile(username: string | undefined): Promise<Result> {
  try {
    const res = await api.get(`/users/${encodeURIComponent(username ?? "")}`);
    return res.data.profile;
  } catch (err) {
    return isAxiosError(err) && err.response?.status === 404 ? "not-found" : "error";
  }
}

function Stat({ value, label, to }: { value: number; label: string; to?: string | false }) {
  const content = (
    <>
      <p className="text-xl font-semibold tabular-nums text-ink-900">{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </>
  );
  return to ? (
    <Link to={to} className="block text-center rounded-xl py-1 hover:bg-ink-100 transition">
      {content}
    </Link>
  ) : (
    <div className="text-center py-1">{content}</div>
  );
}

// A person's community identity: who they are and what they've shared in Discuss under their name.
// Nothing from the Tracker ever appears here.
function Profile() {
  const { username } = useParams();
  const wide = useWideLayout();
  const [result, setResult] = useState<Result | null>(null);
  const [tab, setTab] = useState<"questions" | "replies">("questions");
  const profile = result && typeof result === "object" ? result : null;
  useTitle(profile ? nameOf(profile) : "Profile");

  useEffect(() => {
    let current = true;
    fetchProfile(username).then((r) => current && setResult(r));
    return () => {
      current = false;
    };
  }, [username]);

  const retry = useCallback(() => {
    setResult(null);
    fetchProfile(username).then(setResult);
  }, [username]);

  // Following can open up a private profile's activity (or close it again), so reload it all
  const reload = useCallback(() => {
    fetchProfile(username).then(setResult);
  }, [username]);

  if (result === "not-found") {
    return (
      <main className={`${pageWidth} py-16 text-center`}>
        <UserRound size={32} className="mx-auto text-ink-300" />
        <h1 className="mt-3 text-xl font-semibold text-ink-900">We couldn't find @{username}</h1>
        <p className="mt-1 text-sm text-ink-500">They may have changed their username or deleted their account.</p>
        <Link to="/discuss" className="mt-5 inline-block text-sm font-medium text-brand-700 hover:underline">
          Back to Discuss
        </Link>
      </main>
    );
  }

  if (result === "error") {
    return (
      <main className={`${pageWidth} py-8`}>
        <div role="alert" className="bg-loss-soft text-loss px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-3">
          We couldn't load this profile. Check your connection and try again.
          <button onClick={retry} className="font-medium underline shrink-0">Try again</button>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className={`${pageWidth} py-8`}>
        <div className="h-64 bg-surface border border-line rounded-2xl animate-pulse" />
      </main>
    );
  }

  const joined = new Date(profile.joinedAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const activity = profile.activity;

  const card = (
    <section className="bg-surface border border-line rounded-2xl p-6">
      <div className="flex flex-col items-center text-center">
        <Avatar name={nameOf(profile)} avatarUrl={profile.avatarUrl} size="xl" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink-900">{nameOf(profile)}</h1>
        {profile.displayName && <p className="text-sm text-ink-500">@{profile.username}</p>}
        {profile.bio && <p className="mt-3 text-sm text-ink-700 whitespace-pre-line break-words">{profile.bio}</p>}
        {profile.followsYou && (
          <span className="mt-2 text-xs font-medium text-ink-700 bg-ink-100 px-2 py-0.5 rounded-md">Follows you</span>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
          <CalendarDays size={14} /> Joined {joined}
          {profile.isPrivate && (
            <>
              <span aria-hidden="true">·</span>
              <Lock size={13} /> Private
            </>
          )}
        </p>
      </div>
      {profile.followStatus && (
        <div className="mt-5 flex justify-center">
          <FollowButton username={profile.username} status={profile.followStatus} onChange={reload} />
        </div>
      )}
      {profile.followStatus === "requested" && (
        <p className="mt-2 text-xs text-ink-500 text-center">You'll see their activity once they accept.</p>
      )}
      {/* Counts are shown to everyone; the lists open only when the activity is visible */}
      <div className="mt-6 pt-5 border-t border-line grid grid-cols-2 gap-2">
        <Stat
          value={profile.followerCount}
          label={profile.followerCount === 1 ? "Follower" : "Followers"}
          to={activity ? `/u/${profile.username}/followers` : undefined}
        />
        <Stat value={profile.followingCount} label="Following" to={activity ? `/u/${profile.username}/following` : undefined} />
      </div>
      {activity && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Stat value={activity.questionCount} label={activity.questionCount === 1 ? "Question" : "Questions"} />
          <Stat value={activity.replyCount} label={activity.replyCount === 1 ? "Reply" : "Replies"} />
          <Stat value={activity.helpfulCount} label="Helpful votes" />
        </div>
      )}
      {profile.isMe && (
        <>
          {profile.pendingRequests > 0 && (
            <Link
              to="/follow-requests"
              className="mt-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-brand-50 text-brand-700 text-sm font-medium hover:opacity-90 transition"
            >
              <span className="flex items-center gap-2">
                <UserPlus size={16} /> Follow requests
              </span>
              <span className="tabular-nums">{profile.pendingRequests}</span>
            </Link>
          )}
          <Link
            to="/settings/profile"
            className="mt-6 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-line font-medium text-ink-900 hover:bg-ink-100 transition"
          >
            <Pencil size={15} /> Edit profile
          </Link>
          <p className="mt-3 text-xs text-ink-500 text-center">
            {profile.isPrivate
              ? "Your profile is private: only followers you accept see your activity."
              : "This is how others see your profile. Anonymous posts never appear here."}
          </p>
        </>
      )}
    </section>
  );

  const tabs = activity && (
    <div role="tablist" aria-label="Activity" className="grid grid-cols-2 p-1 bg-ink-100 rounded-xl text-sm font-medium max-w-sm">
      {(["questions", "replies"] as const).map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={tab === t}
          onClick={() => setTab(t)}
          className={`py-2 rounded-lg capitalize transition ${tab === t ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
        >
          {t} ({t === "questions" ? activity.questionCount : activity.replyCount})
        </button>
      ))}
    </div>
  );

  const empty = (message: string) => (
    <div className="bg-surface border border-line rounded-2xl p-10 text-center text-sm text-ink-500">{message}</div>
  );

  const list = !activity ? (
    <div className="bg-surface border border-line rounded-2xl p-10 text-center">
      <Lock size={28} className="mx-auto text-ink-300" />
      <p className="mt-3 font-medium text-ink-900">This profile is private</p>
      <p className="mt-1 text-sm text-ink-500">
        {profile.followStatus === "requested"
          ? `You've asked to follow ${nameOf(profile)}. Their activity will show here once they accept.`
          : `Follow ${nameOf(profile)} to see their questions and replies.`}
      </p>
    </div>
  ) : tab === "questions" ? (
    activity.questions.length === 0 ? (
      empty(profile.isMe ? "Questions you ask under your name will show here." : "No questions asked under their name yet.")
    ) : (
      <ul className="bg-surface border border-line rounded-2xl divide-y divide-line">
        {activity.questions.map((q) => (
          <li key={q.id}>
            <Link to={`/discuss/${q.id}`} className="block p-5 hover:bg-canvas transition">
              <span className="text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">{q.topic}</span>
              <p className="mt-2 font-medium text-ink-900">{q.title}</p>
              <p className="mt-1.5 flex items-center gap-3 text-xs text-ink-500">
                {timeAgo(q.createdAt)}
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
    empty(profile.isMe ? "Replies you post under your name will show here." : "No replies under their name yet.")
  ) : (
    <ul className="bg-surface border border-line rounded-2xl divide-y divide-line">
      {activity.replies.map((r) => (
        <li key={r.id}>
          <Link to={`/discuss/${r.postId}`} className="block p-5 hover:bg-canvas transition">
            <p className="text-xs text-ink-500">
              Replied to <span className="font-medium text-ink-700">{r.postTitle}</span>
            </p>
            <p className="mt-1.5 text-sm text-ink-700 line-clamp-3">{r.body}</p>
            <p className="mt-1.5 flex items-center gap-3 text-xs text-ink-500">
              {timeAgo(r.createdAt)}
              {r.helpfulCount > 0 && (
                <span className="flex items-center gap-1">
                  <ThumbsUp size={13} /> {r.helpfulCount} found this helpful
                </span>
              )}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );

  const shownNote = activity && (activity.questionCount > activity.questions.length || activity.replyCount > activity.replies.length) && (
    <p className="text-xs text-ink-500">Showing the most recent 20.</p>
  );

  return (
    <main className={`${pageWidth} py-8`}>
      {wide ? (
        <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-10 items-start">
          <div className="sticky top-24">{card}</div>
          <div className="space-y-5 min-w-0">
            <h2 className="text-lg font-semibold text-ink-900">Activity in Discuss</h2>
            {tabs}
            {list}
            {shownNote}
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-6">
          {card}
          {tabs}
          {list}
          {shownNote}
        </div>
      )}
    </main>
  );
}

export default Profile;
