import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../lib/api";
import { useTitle } from "../lib/useTitle";
import { pageWidth } from "../lib/ui";
import { nameOf } from "../lib/me";
import { activePhrase, lastActiveLabel, percentOf, plural, shortDate, weekLabel } from "../lib/admin";
import type { AdminMessageReport, AdminOverview, AdminPerson, AdminReport } from "../lib/admin";
import Avatar from "../components/Avatar";
import NotFound from "./NotFound";

function Card({ title, aside, children, className = "" }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-surface border border-line rounded-2xl p-6 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-semibold text-ink-900">{title}</h2>
        {aside && <span className="text-sm text-ink-500">{aside}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink-900 tabular-nums">{value.toLocaleString("en-IN")}</p>
      <p className="mt-0.5 text-sm text-ink-500 truncate">{detail}</p>
    </div>
  );
}

function SignupsChart({ weeks }: { weeks: AdminOverview["signupsByWeek"] }) {
  const data = weeks.map((w) => ({ ...w, label: weekLabel(w.week) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: "var(--color-ink-500)", fontSize: 12 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fill: "var(--color-ink-500)", fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: "var(--color-ink-100)" }}
          labelFormatter={(label) => `Week of ${label}`}
          formatter={(v) => [plural(Number(v), "signup"), ""]}
          separator=""
        />
        <Bar dataKey="signups" name="Signups" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function FeatureUse({ features, total }: { features: AdminOverview["features"]; total: number }) {
  return (
    <ul className="space-y-4">
      {features.map((f) => {
        const share = percentOf(f.users, total);
        return (
          <li key={f.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink-900">{f.label}</span>
              <span className="text-ink-500 tabular-nums shrink-0">
                {plural(f.users, "person", "people")} · {share}%
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-ink-100 overflow-hidden">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${share}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ReportItem({ item }: { item: AdminReport }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
        <span className="rounded-md bg-ink-100 text-ink-700 px-2 py-0.5">{item.kind === "question" ? "Question" : "Reply"}</span>
        {item.hidden && <span className="rounded-md bg-warn-soft text-warn px-2 py-0.5">Hidden</span>}
        <span className="text-ink-500 font-normal">
          {plural(item.reports, "report")}, last on {shortDate(item.lastReportedAt)}
        </span>
      </div>
      <Link to={`/discuss/${item.postId}`} className="mt-2 block font-medium text-ink-900 hover:underline">
        {item.kind === "reply" ? `Reply in: ${item.title}` : item.title}
      </Link>
      {item.excerpt && <p className="mt-1 text-sm text-ink-700 break-words">{item.excerpt}</p>}
      <p className="mt-1 text-sm text-ink-500">{item.reasons.map((r) => (r.count > 1 ? `${r.reason} (${r.count})` : r.reason)).join(", ")}</p>
    </li>
  );
}

function MessageReportItem({ item }: { item: AdminMessageReport }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
        {item.unsent && <span className="rounded-md bg-ink-100 text-ink-700 px-2 py-0.5">Since deleted by sender</span>}
        <span className="text-ink-500 font-normal">
          {plural(item.reports, "report")}, last on {shortDate(item.lastReportedAt)}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-900 break-words">{item.text}</p>
      <p className="mt-1 text-sm text-ink-500">
        From{" "}
        {item.sender ? (
          <Link to={`/u/${item.sender.username}`} className="font-medium text-ink-700 hover:underline">
            {nameOf(item.sender)} (@{item.sender.username})
          </Link>
        ) : (
          "a deleted account"
        )}
        {" · "}
        {item.reasons.map((r) => (r.count > 1 ? `${r.reason} (${r.count})` : r.reason)).join(", ")}
      </p>
    </li>
  );
}

function PersonItem({ person }: { person: AdminPerson }) {
  const active = lastActiveLabel(person.lastActiveAt);
  return (
    <li className="flex items-center gap-3 py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_8rem_7rem] sm:gap-4">
      <Link to={`/u/${person.username}`} className="flex items-center gap-3 min-w-0 flex-1 group">
        <Avatar name={nameOf(person)} avatarUrl={person.avatarUrl} size="lg" />
        <span className="min-w-0">
          <span className="block font-medium text-ink-900 truncate group-hover:underline">{nameOf(person)}</span>
          <span className="block text-sm text-ink-500 truncate">@{person.username}</span>
          {/* On phones the columns fold into one line under the name */}
          <span className="block text-xs text-ink-500 sm:hidden">
            Joined {shortDate(person.joinedAt)} · {activePhrase(person.lastActiveAt)}
            {!person.verified && " · Email not confirmed"}
          </span>
        </span>
      </Link>
      <span className="hidden sm:block text-sm text-ink-700 tabular-nums">{shortDate(person.joinedAt)}</span>
      <span className="hidden sm:block text-sm text-ink-700">{active}</span>
      <span className={`hidden sm:block text-sm ${person.verified ? "text-ink-700" : "text-ink-500"}`}>{person.verified ? "Confirmed" : "Not confirmed"}</span>
    </li>
  );
}

export default function Admin() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  useTitle(state === "missing" ? "Page not found" : "Admin");

  useEffect(() => {
    let current = true;
    api.get("/admin").then(
      (res) => {
        if (!current) return;
        setData(res.data);
        setState("ready");
      },
      (err) => {
        if (!current) return;
        setState(isAxiosError(err) && err.response?.status === 404 ? "missing" : "error");
      }
    );
    return () => {
      current = false;
    };
  }, []);

  // Everyone but the admin sees the usual missing-page screen
  if (state === "missing") return <NotFound />;

  if (state === "error") {
    return (
      <main className={`${pageWidth} py-8`}>
        <section className="bg-surface border border-line rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-ink-900">We couldn't load this page</h1>
          <p className="mt-2 text-sm text-ink-500">Please check your connection and try again.</p>
          <button onClick={() => window.location.reload()} className="mt-5 text-sm font-medium text-brand-600 hover:underline">
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (state === "loading" || !data) {
    return (
      <main className={`${pageWidth} py-8 space-y-6`} aria-busy="true">
        <div className="h-8 w-48 rounded-lg bg-ink-100 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-ink-100 animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-ink-100 animate-pulse" />
      </main>
    );
  }

  const { users, active, discuss, reports, people } = data;
  const openReports = reports.length;

  return (
    <main className={`${pageWidth} py-8 space-y-6`}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Admin</h1>
        <p className="mt-1 text-sm text-ink-500">Only you can see this page. It counts people and what they use, and never shows anyone's money.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <Stat label="Users" value={users.total} detail={`${users.verified.toLocaleString("en-IN")} confirmed email`} />
        <Stat label="New this week" value={users.newThisWeek} detail="Last 7 days" />
        <Stat label="New this month" value={users.newThisMonth} detail="Last 30 days" />
        <Stat label="Active today" value={active.today} detail="Last 24 hours" />
        <Stat label="Active this week" value={active.week} detail="Last 7 days" />
        <Stat label="Active this month" value={active.month} detail="Last 30 days" />
      </div>
      <p className="-mt-2 text-xs text-ink-500">Activity is counted from November 2026, when this page went live.</p>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Signups per week" aside="Last 12 weeks" className="xl:col-span-2">
          <SignupsChart weeks={data.signupsByWeek} />
        </Card>
        <Card title="Discuss">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
            {[
              ["Questions", discuss.questions],
              ["Replies", discuss.replies],
              ["Questions this week", discuss.questionsThisWeek],
              ["Replies this week", discuss.repliesThisWeek],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</dt>
                <dd className="mt-1 text-xl font-semibold text-ink-900 tabular-nums">{Number(value).toLocaleString("en-IN")}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 border-t border-line pt-4 text-sm text-ink-500">
            {openReports === 0 ? "Nothing has been reported." : `${plural(openReports, "item")} reported. See Reports below.`}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 items-start">
        <Card title="Who uses what" aside="Share of all users">
          <FeatureUse features={data.features} total={users.total} />
        </Card>
        <Card title="Reports" aside={openReports > 0 ? "Newest first" : undefined}>
          {openReports === 0 ? (
            <p className="text-sm text-ink-500">No questions or replies have been reported.</p>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {reports.map((r) => (
                  <ReportItem key={`${r.kind}:${r.id}`} item={r} />
                ))}
              </ul>
              <p className="mt-4 border-t border-line pt-4 text-xs text-ink-500">
                Anything with 3 reports is hidden from everyone. Its text is shown only here.
              </p>
            </>
          )}
        </Card>
      </div>

      <Card title="Reported messages" aside={data.messageReports.length > 0 ? "Newest first" : undefined}>
        {data.messageReports.length === 0 ? (
          <p className="text-sm text-ink-500">No chat messages have been reported.</p>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {data.messageReports.map((m) => (
                <MessageReportItem key={m.id} item={m} />
              ))}
            </ul>
            <p className="mt-4 border-t border-line pt-4 text-xs text-ink-500">
              Only reported messages appear here, as they were when reported. Nothing else from anyone's chats is shown.
            </p>
          </>
        )}
      </Card>

      <Card title="People" aside={people.shown.length < people.total ? `Newest ${people.shown.length} of ${people.total}` : "Newest first"}>
        <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_8rem_7rem] sm:gap-4 pb-2 border-b border-line text-xs font-medium uppercase tracking-wider text-ink-500">
          <span>Person</span>
          <span>Joined</span>
          <span>Last active</span>
          <span>Email</span>
        </div>
        <ul className="divide-y divide-line">
          {people.shown.map((p) => (
            <PersonItem key={p.username} person={p} />
          ))}
        </ul>
      </Card>
    </main>
  );
}
