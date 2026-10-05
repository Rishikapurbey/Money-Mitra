import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Globe,
  HelpCircle,
  Lock,
  MessageCircle,
  Pencil,
  ThumbsUp,
  UserPlus,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import api from "../lib/api";
import { nameOf } from "../lib/me";
import type { Profile as ProfileData } from "../lib/profile";
import { timeAgo } from "../lib/discuss";
import { pageWidth } from "../lib/ui";
import { useTitle } from "../lib/useTitle";
import { useWideLayout } from "../lib/useMediaQuery";
import Avatar from "../components/Avatar";
import FollowButton from "../components/FollowButton";
import { CoverBand, CoverEditor } from "../components/ProfileCover";

type Result = ProfileData | "not-found" | "error";

async function fetchProfile(username: string | undefined): Promise<Result> {
  try {
    const res = await api.get(`/users/${encodeURIComponent(username ?? "")}`);
    return res.data.profile;
  } catch (err) {
    return isAxiosError(err) && err.response?.status === 404 ? "not-found" : "error";
  }
}

// A person's community identity: who they are and what they've shared in Discuss under their name.
// Nothing from the Tracker ever appears here.
function Profile() {
  const { username } = useParams();
  const wide = useWideLayout();
  const [result, setResult] = useState<Result | null>(null);
  const [tab, setTab] = useState<"questions" | "replies">("questions");
  const [editingCover, setEditingCover] = useState(false);
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
  const name = nameOf(profile);

  const socialCount = (value: number, label: string, to: string) => {
    const content = (
      <>
        <span className="font-semibold tabular-nums text-ink-900">{value}</span> {label}
      </>
    );
    // The lists only open when the activity is visible
    return activity ? (
      <Link to={to} className="text-sm text-ink-500 hover:text-ink-900 hover:underline">
        {content}
      </Link>
    ) : (
      <span className="text-sm text-ink-500">{content}</span>
    );
  };

  const actions = profile.isMe ? (
    <div className="flex flex-wrap items-center gap-2">
      {profile.pendingRequests > 0 && (
        <Link
          to="/follow-requests"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-50 text-brand-700 text-sm font-medium hover:opacity-90 transition"
        >
          <UserPlus size={15} /> Follow requests
          <span className="min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-xs leading-5 text-center tabular-nums">
            {profile.pendingRequests}
          </span>
        </Link>
      )}
      <Link
        to="/settings/profile"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line text-sm font-medium text-ink-900 hover:bg-ink-100 transition"
      >
        <Pencil size={15} /> Edit profile
      </Link>
    </div>
  ) : (
    profile.followStatus && <FollowButton username={profile.username} status={profile.followStatus} onChange={reload} />
  );

  const header = (
    <section className="bg-surface border border-line rounded-2xl overflow-hidden">
      <CoverBand cover={profile} onEdit={profile.isMe ? () => setEditingCover(true) : undefined} />
      <div className="px-5 sm:px-8 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="relative -mt-14 rounded-full ring-4 ring-surface bg-surface">
            <Avatar name={name} avatarUrl={profile.avatarUrl} size="2xl" />
          </div>
          <div className="pt-4">{actions}</div>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{name}</h1>
            {profile.isPrivate && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 bg-ink-100 px-2 py-0.5 rounded-md">
                <Lock size={12} /> Private
              </span>
            )}
            {profile.followsYou && (
              <span className="text-xs font-medium text-ink-700 bg-ink-100 px-2 py-0.5 rounded-md">Follows you</span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-500">
            <span>@{profile.username}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} /> Joined {joined}
            </span>
          </p>
          {profile.bio && <p className="mt-3 max-w-2xl text-ink-700 whitespace-pre-line break-words">{profile.bio}</p>}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
            {socialCount(profile.followerCount, profile.followerCount === 1 ? "follower" : "followers", `/u/${profile.username}/followers`)}
            {socialCount(profile.followingCount, "following", `/u/${profile.username}/following`)}
          </div>
          {profile.followStatus === "requested" && (
            <p className="mt-3 text-sm text-ink-500">Request sent. You'll see their activity once they accept.</p>
          )}
        </div>
        {profile.isMe && editingCover && <CoverEditor cover={profile} onChanged={reload} onClose={() => setEditingCover(false)} />}
      </div>
    </section>
  );

  const tabs = activity && (
    <div role="tablist" aria-label="Activity" className="flex gap-6 border-b border-line">
      {(["questions", "replies"] as const).map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={tab === t}
          onClick={() => setTab(t)}
          className={`-mb-px pb-3 border-b-2 text-sm font-medium capitalize transition ${
            tab === t ? "border-brand-600 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900"
          }`}
        >
          {t}
          <span className="ml-1.5 text-ink-400 tabular-nums">{t === "questions" ? activity.questionCount : activity.replyCount}</span>
        </button>
      ))}
    </div>
  );

  const emptyState = (icon: LucideIcon, title: string, text: string, action?: { to: string; label: string }) => {
    const Icon = icon;
    return (
      <div className="bg-surface border border-line rounded-2xl px-6 py-14 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center">
          <Icon size={22} className="text-brand-600" />
        </div>
        <p className="mt-4 font-medium text-ink-900">{title}</p>
        <p className="mt-1 text-sm text-ink-500 max-w-sm mx-auto">{text}</p>
        {action && (
          <Link
            to={action.to}
            className="mt-5 inline-flex items-center gap-1.5 bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition"
          >
            {action.label}
          </Link>
        )}
      </div>
    );
  };

  const list = !activity
    ? emptyState(
        Lock,
        "This profile is private",
        profile.followStatus === "requested"
          ? `You've asked to follow ${name}. Their questions and replies will show here once they accept.`
          : `Follow ${name} to see their questions and replies.`
      )
    : tab === "questions"
      ? activity.questions.length === 0
        ? profile.isMe
          ? emptyState(HelpCircle, "You haven't asked anything yet", "No question is too basic. Questions you ask under your name show here.", {
              to: "/discuss?ask=1",
              label: "Ask a question",
            })
          : emptyState(HelpCircle, "No questions yet", `${name} hasn't asked anything under their name yet.`)
        : (
          <ul className="bg-surface border border-line rounded-2xl divide-y divide-line">
            {activity.questions.map((q) => (
              <li key={q.id}>
                <Link to={`/discuss/${q.id}`} className="block px-5 py-4 hover:bg-canvas transition">
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
      : activity.replies.length === 0
        ? profile.isMe
          ? emptyState(MessageCircle, "Share what you know", "Your answers help someone else make a better money decision. Replies under your name show here.", {
              to: "/discuss",
              label: "Answer a question",
            })
          : emptyState(MessageCircle, "No replies yet", `${name} hasn't replied under their name yet.`)
        : (
          <ul className="bg-surface border border-line rounded-2xl divide-y divide-line">
            {activity.replies.map((r) => (
              <li key={r.id}>
                <Link to={`/discuss/${r.postId}`} className="block px-5 py-4 hover:bg-canvas transition">
                  <p className="text-xs text-ink-500">
                    Replied to <span className="font-medium text-ink-700">{r.postTitle}</span>
                  </p>
                  <p className="mt-1.5 text-sm text-ink-700 line-clamp-3">{r.body}</p>
                  <p className="mt-1.5 flex items-center gap-3 text-xs text-ink-500">
                    {timeAgo(r.createdAt)}
                    {r.accepted && (
                      <span className="flex items-center gap-1 font-medium text-gain">
                        <CheckCircle2 size={13} /> Accepted answer
                      </span>
                    )}
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

  // Your own profile: what's left to make it feel like yours
  const steps = profile.isMe
    ? [
        { done: Boolean(profile.avatarUrl), label: "Add a photo", to: "/settings/profile" },
        { done: Boolean(profile.displayName), label: "Add your name", to: "/settings/profile" },
        { done: Boolean(profile.bio), label: "Write a short bio", to: "/settings/profile" },
        {
          done: Boolean(activity && activity.questionCount + activity.replyCount > 0),
          label: "Ask or answer a question",
          to: "/discuss",
        },
      ]
    : [];
  const doneCount = steps.filter((s) => s.done).length;

  const checklist = steps.length > 0 && doneCount < steps.length && (
    <section className="bg-surface border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-ink-900">Complete your profile</h2>
        <span className="text-xs font-medium text-ink-500 tabular-nums">
          {doneCount} of {steps.length}
        </span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-ink-100 overflow-hidden">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-4 space-y-1">
        {steps.map((step) => (
          <li key={step.label}>
            {step.done ? (
              <span className="flex items-center gap-2.5 py-1.5 text-sm text-ink-400 line-through">
                <CheckCircle2 size={17} className="text-brand-600 shrink-0" /> {step.label}
              </span>
            ) : (
              <Link to={step.to} className="flex items-center gap-2.5 py-1.5 text-sm text-ink-900 hover:text-brand-700 group">
                <Circle size={17} className="text-ink-300 shrink-0" />
                <span className="flex-1">{step.label}</span>
                <ArrowRight size={14} className="text-ink-300 group-hover:text-brand-600" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );

  const community = activity && (
    <section className="bg-surface border border-line rounded-2xl p-5">
      <h2 className="font-semibold text-ink-900">In the community</h2>
      <ul className="mt-3 space-y-3">
        {[
          { icon: HelpCircle, value: activity.questionCount, label: activity.questionCount === 1 ? "question asked" : "questions asked" },
          { icon: MessageCircle, value: activity.replyCount, label: activity.replyCount === 1 ? "reply given" : "replies given" },
          { icon: ThumbsUp, value: activity.helpfulCount, label: activity.helpfulCount === 1 ? "helpful vote received" : "helpful votes received" },
          { icon: CheckCircle2, value: activity.acceptedCount, label: activity.acceptedCount === 1 ? "accepted answer" : "accepted answers" },
        ].map(({ icon: Icon, value, label }) => (
          <li key={label} className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <Icon size={17} className="text-brand-600" />
            </span>
            <span className="text-sm text-ink-500">
              <span className="block text-lg font-semibold leading-tight tabular-nums text-ink-900">{value}</span>
              {label}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 pt-4 border-t border-line text-xs text-ink-500">Only posts made under their name count. Anonymous posts never appear on a profile.</p>
    </section>
  );

  const visibility = profile.isMe && (
    <section className="bg-surface border border-line rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-semibold text-ink-900">
        {profile.isPrivate ? <Lock size={16} className="text-ink-500" /> : <Globe size={16} className="text-ink-500" />}
        {profile.isPrivate ? "Private profile" : "Public profile"}
      </h2>
      <p className="mt-1.5 text-sm text-ink-500">
        {profile.isPrivate
          ? "Only followers you accept see your questions, replies and followers."
          : "Anyone signed in can see your questions, replies and followers."}{" "}
        Your money data is never shown to anyone.
      </p>
      <Link to="/settings/privacy" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
        Privacy settings <ArrowRight size={14} />
      </Link>
    </section>
  );

  const main = (
    <div className="space-y-5 min-w-0">
      {tabs}
      {list}
      {shownNote}
    </div>
  );

  const rail = (
    <aside className="space-y-5">
      {checklist}
      {community}
      {visibility}
    </aside>
  );

  return (
    <main className={`${pageWidth} py-8 space-y-6`}>
      {header}
      {wide ? (
        <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
          {main}
          {rail}
        </div>
      ) : (
        <div className="space-y-6">
          {checklist}
          {main}
          {community}
          {visibility}
        </div>
      )}
    </main>
  );
}

export default Profile;
