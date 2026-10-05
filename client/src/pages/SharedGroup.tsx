import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { Archive, ArchiveRestore, ArrowLeft, ArrowRight, HandCoins, LogOut, Pencil, Plus, Receipt, Trash2, X } from "lucide-react";
import api from "../lib/api";
import { useTitle } from "../lib/useTitle";
import { useToast } from "../lib/toast";
import { formatINR, inputClass, pageWidth } from "../lib/ui";
import { timeAgo } from "../lib/discuss";
import { announceDataChange } from "../lib/dataEvents";
import { myPosition } from "../lib/shared";
import type { GroupDetail, Payment, SharedExpense, Settlement } from "../lib/shared";
import ExpenseForm from "../components/shared/ExpenseForm";
import SettleForm from "../components/shared/SettleForm";
import { AddMemberForm, MemberRow } from "../components/shared/Members";

const errorText = (err: unknown, fallback: string) => (isAxiosError(err) && err.response?.data?.error) || fallback;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const outlineButton =
  "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-ink-700 border border-line bg-surface hover:bg-ink-100 transition";

type Panel = { kind: "expense"; expense?: SharedExpense } | { kind: "settle"; suggestion: Payment | null } | null;

function ExpenseRow({
  group,
  expense,
  nameOf,
  onEdit,
  onChanged,
}: {
  group: GroupDetail;
  expense: SharedExpense;
  nameOf: (id: string) => string;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const position = myPosition(expense, group.myMemberId);

  const remove = async () => {
    try {
      await api.delete(`/shared/groups/${group.id}/expenses/${expense.id}`);
      announceDataChange();
      toast({ message: `${expense.description} deleted` });
      onChanged();
    } catch (err) {
      setConfirming(false);
      toast({ message: errorText(err, "We couldn't delete it. Please try again.") });
    }
  };

  return (
    <li>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-canvas transition">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-ink-100 text-ink-500 flex items-center justify-center">
          <Receipt size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink-900 truncate">{expense.description}</span>
          <span className="block text-sm text-ink-500 truncate">
            {nameOf(expense.paidById)} paid {formatINR(expense.amount)} · {shortDate(expense.date)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          {position.kind === "none" ? (
            <span className="text-xs text-ink-400">Not involved</span>
          ) : (
            <>
              <span className="block text-xs text-ink-500">{position.kind === "lent" ? "You lent" : "Your share"}</span>
              <span className={`block text-sm font-semibold tabular-nums ${position.kind === "lent" ? "text-brand-600" : "text-ink-900"}`}>
                {formatINR(position.amount)}
              </span>
            </>
          )}
        </span>
      </button>
      {open && (
        <div className="px-5 pb-4 -mt-1">
          <div className="rounded-xl bg-canvas border border-line p-4 text-sm space-y-3">
            <p className="text-ink-500">{expense.category}</p>
            <ul className="space-y-1.5">
              {expense.shares.map((s) => (
                <li key={s.memberId} className="flex justify-between gap-3">
                  <span className="text-ink-700">{nameOf(s.memberId)}</span>
                  <span className="tabular-nums text-ink-900">{formatINR(s.amount)}</span>
                </li>
              ))}
            </ul>
            {!group.archived &&
              (confirming ? (
                <div className="border-t border-line pt-3">
                  <p className="text-ink-700">Delete {expense.description}? It's taken out of everyone's Tracker too.</p>
                  <div className="mt-2 flex gap-3">
                    <button onClick={remove} className="font-medium text-loss hover:underline">
                      Delete
                    </button>
                    <button onClick={() => setConfirming(false)} className="text-ink-500 hover:text-ink-900">
                      Keep
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-line pt-3 flex gap-4">
                  <button onClick={onEdit} className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:text-brand-700">
                    <Pencil size={14} /> Edit
                  </button>
                  <button onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 text-ink-500 hover:text-loss">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </li>
  );
}

function SettlementRow({ group, settlement, nameOf, onChanged }: { group: GroupDetail; settlement: Settlement; nameOf: (id: string) => string; onChanged: () => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  const remove = async () => {
    try {
      await api.delete(`/shared/groups/${group.id}/settlements/${settlement.id}`);
      toast({ message: "Payment removed" });
      onChanged();
    } catch (err) {
      setConfirming(false);
      toast({ message: errorText(err, "We couldn't remove it. Please try again.") });
    }
  };

  return (
    <li className="px-5 py-4">
      <div className="flex items-center gap-4">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
          <HandCoins size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ink-900 truncate">
            <span className="font-medium">{nameOf(settlement.fromMemberId)}</span> paid{" "}
            <span className="font-medium">{nameOf(settlement.toMemberId)}</span>
          </p>
          <p className="text-sm text-ink-500">{shortDate(settlement.date)}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-900">{formatINR(settlement.amount)}</span>
        {!group.archived && (
          <button onClick={() => setConfirming(true)} aria-label="Remove payment" className="shrink-0 text-ink-300 hover:text-loss transition">
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {confirming && (
        <div className="mt-3 rounded-xl bg-canvas border border-line p-3 text-sm">
          <p className="text-ink-700">Remove this payment? The balances go back to how they were before it.</p>
          <div className="mt-2 flex gap-3">
            <button onClick={remove} className="font-medium text-loss hover:underline">
              Remove
            </button>
            <button onClick={() => setConfirming(false)} className="text-ink-500 hover:text-ink-900">
              Keep
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function SharedGroup() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loadError, setLoadError] = useState<"missing" | "failed" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [allActivity, setAllActivity] = useState(false);
  useTitle(group?.name ?? "Shared group");

  const load = useCallback(() => {
    api
      .get(`/shared/groups/${id}`)
      .then((res) => {
        setGroup(res.data.group);
        setLoadError(null);
      })
      .catch((err) => setLoadError(isAxiosError(err) && err.response?.status === 404 ? "missing" : "failed"));
  }, [id]);

  useEffect(load, [load]);

  const openPanel = (next: Panel) => {
    setPanel(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    setRenameError("");
    try {
      await api.put(`/shared/groups/${id}`, { name });
      setRenaming(false);
      load();
    } catch (err) {
      setRenameError(errorText(err, "We couldn't rename the group. Please try again."));
    }
  };

  const setArchived = async (archived: boolean) => {
    try {
      await api.put(`/shared/groups/${id}/archive`, { archived });
      toast({ message: archived ? "Group archived" : "Group moved back to your groups" });
      setPanel(null);
      load();
    } catch (err) {
      toast({ message: errorText(err, "We couldn't do that. Please try again.") });
    }
  };

  const leave = async () => {
    try {
      await api.post(`/shared/groups/${id}/leave`);
      toast({ message: `You left ${group?.name}` });
      navigate("/shared");
    } catch (err) {
      setLeaving(false);
      toast({ message: errorText(err, "We couldn't do that. Please try again.") });
    }
  };

  const back = (
    <Link to="/shared" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition">
      <ArrowLeft size={16} /> Shared expenses
    </Link>
  );

  if (loadError) {
    return (
      <main className={`${pageWidth} py-8 space-y-6`}>
        {back}
        {loadError === "missing" ? (
          <div className="bg-surface border border-line rounded-2xl p-10 text-center">
            <p className="font-medium text-ink-900">This group isn't available</p>
            <p className="mt-1 text-sm text-ink-500">It may have been deleted, or you're no longer a member.</p>
          </div>
        ) : (
          <div role="alert" className="flex items-center gap-3 bg-loss-soft text-loss px-4 py-3 rounded-xl text-sm">
            <span className="flex-1">We couldn't load this group. Please try again.</span>
            <button onClick={load} className="font-medium underline underline-offset-2">
              Retry
            </button>
          </div>
        )}
      </main>
    );
  }
  if (!group) {
    return (
      <main className={`${pageWidth} py-8 space-y-6`} aria-busy="true">
        {back}
        <div className="h-44 rounded-2xl bg-ink-100 animate-pulse" />
      </main>
    );
  }

  const active = group.members.filter((m) => m.status === "active");
  const invited = group.members.filter((m) => m.status === "invited");
  const me = group.members.find((m) => m.id === group.myMemberId);
  const myBalance = me?.balance ?? 0;
  const nameOf = (memberId: string) => {
    const m = group.members.find((x) => x.id === memberId);
    return !m ? "Someone" : m.isMe ? "You" : m.name;
  };
  const owing = group.members.filter((m) => m.balance !== 0);
  const timeline = [
    ...group.expenses.map((e) => ({ kind: "expense" as const, date: e.date, item: e })),
    ...group.settlements.map((s) => ({ kind: "settlement" as const, date: s.date, item: s })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const activity = allActivity ? group.activity : group.activity.slice(0, 8);
  const done = (saved: boolean) => {
    setPanel(null);
    if (saved) load();
  };

  return (
    <main className={`${pageWidth} py-8 space-y-6`}>
      <div className="space-y-4">
        {back}
        <div className="flex flex-wrap items-start justify-between gap-4">
          {renaming ? (
            <form onSubmit={rename} className="flex flex-wrap items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
                autoFocus
                aria-label="Group name"
                className={`${inputClass} py-1.5 text-lg font-semibold w-72 max-w-full`}
              />
              <button type="submit" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition">
                Save
              </button>
              <button type="button" onClick={() => setRenaming(false)} aria-label="Cancel" className="text-ink-400 hover:text-ink-900">
                <X size={16} />
              </button>
              {renameError && <p role="alert" className="w-full text-sm text-loss">{renameError}</p>}
            </form>
          ) : (
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-ink-900 truncate">{group.name}</h1>
                <button
                  onClick={() => {
                    setName(group.name);
                    setRenaming(true);
                  }}
                  aria-label="Rename group"
                  className="text-ink-300 hover:text-brand-600 transition"
                >
                  <Pencil size={15} />
                </button>
                {group.archived && <span className="text-xs font-medium text-ink-500 bg-ink-100 px-2 py-0.5 rounded">Archived</span>}
              </div>
              <p className="mt-1 text-sm text-ink-500">
                {active.length} {active.length === 1 ? "member" : "members"}
                {invited.length > 0 && ` · ${invited.length} invited`}
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {!group.archived && (
              <>
                <button onClick={() => openPanel({ kind: "expense" })} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition">
                  <Plus size={16} /> Add expense
                </button>
                <button onClick={() => openPanel({ kind: "settle", suggestion: null })} className={outlineButton}>
                  <HandCoins size={15} /> Settle up
                </button>
              </>
            )}
            <button onClick={() => setArchived(!group.archived)} className={outlineButton}>
              {group.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />} {group.archived ? "Unarchive" : "Archive"}
            </button>
            <button onClick={() => setLeaving(true)} className={outlineButton}>
              <LogOut size={15} /> Leave
            </button>
          </div>
        </div>
        {leaving && (
          <div className="rounded-xl bg-surface border border-line p-4 text-sm">
            {myBalance !== 0 ? (
              <p className="text-ink-700">
                {myBalance < 0 ? `You owe ${formatINR(-myBalance)}` : `You're owed ${formatINR(myBalance)}`} in this group. Settle up before leaving.
              </p>
            ) : (
              <p className="text-ink-700">
                Leave {group.name}? It disappears from your list, and your shares stay in your Tracker. A member can invite you back later.
                {active.filter((m) => m.person).length === 1 && " You're the last person here on Money Mitra, so the group will be deleted."}
              </p>
            )}
            <div className="mt-2 flex gap-3">
              {myBalance === 0 && (
                <button onClick={leave} className="font-medium text-loss hover:underline">
                  Leave group
                </button>
              )}
              <button onClick={() => setLeaving(false)} className="text-ink-500 hover:text-ink-900">
                {myBalance === 0 ? "Stay" : "Close"}
              </button>
            </div>
          </div>
        )}
        {group.archived && <p className="text-sm text-ink-500">This group is archived. Unarchive it to add expenses or payments.</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="space-y-6 min-w-0">
          {panel?.kind === "expense" && <ExpenseForm key={panel.expense?.id ?? "new"} group={group} expense={panel.expense} onDone={done} />}
          {panel?.kind === "settle" && <SettleForm key={JSON.stringify(panel.suggestion)} group={group} suggestion={panel.suggestion} onDone={done} />}

          <section className="dark-panel bg-ink-900 rounded-2xl p-6 text-white">
            <p className="text-ink-300 text-xs font-medium uppercase tracking-wider">Your balance</p>
            <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${myBalance > 0 ? "text-brand-300" : ""}`}>
              {myBalance === 0 ? "All settled up" : formatINR(Math.abs(myBalance))}
            </p>
            {myBalance !== 0 && <p className="mt-1 text-sm text-ink-300">{myBalance > 0 ? "You're owed this in total" : "You owe this in total"}</p>}
          </section>

          <section className="bg-surface border border-line rounded-2xl">
            <h2 className="px-5 pt-5 font-semibold text-ink-900">Expenses and payments</h2>
            {timeline.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Receipt size={28} className="mx-auto text-ink-300" />
                <p className="mt-3 text-sm text-ink-500">Nothing added yet. Add the first expense and Money Mitra works out who owes whom.</p>
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {timeline.map((entry) =>
                  entry.kind === "expense" ? (
                    <ExpenseRow
                      key={entry.item.id}
                      group={group}
                      expense={entry.item}
                      nameOf={nameOf}
                      onEdit={() => openPanel({ kind: "expense", expense: entry.item })}
                      onChanged={load}
                    />
                  ) : (
                    <SettlementRow key={entry.item.id} group={group} settlement={entry.item} nameOf={nameOf} onChanged={load} />
                  )
                )}
              </ul>
            )}
          </section>

          {group.activity.length > 0 && (
            <section className="bg-surface border border-line rounded-2xl p-5">
              <h2 className="font-semibold text-ink-900">Activity</h2>
              <ul className="mt-3 space-y-2.5 text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="flex justify-between gap-4">
                    <span className="text-ink-700 min-w-0">{a.message}</span>
                    <span className="shrink-0 text-xs text-ink-400">{timeAgo(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
              {group.activity.length > 8 && (
                <button onClick={() => setAllActivity((s) => !s)} className="mt-3 text-sm font-medium text-brand-600 hover:underline">
                  {allActivity ? "Show less" : "Show all"}
                </button>
              )}
            </section>
          )}
        </div>

        <div className="space-y-6 min-w-0">
          <section className="bg-surface border border-line rounded-2xl p-5">
            <h2 className="font-semibold text-ink-900">Balances</h2>
            {owing.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">Everyone is settled up.</p>
            ) : (
              <>
                <ul className="mt-3 space-y-2 text-sm">
                  {owing.map((m) => (
                    <li key={m.id} className="flex justify-between gap-3">
                      <span className="text-ink-700 truncate">{m.isMe ? "You" : m.name}</span>
                      <span className={`tabular-nums font-medium ${m.balance > 0 ? "text-brand-600" : "text-ink-900"}`}>
                        {m.balance > 0 ? `gets back ${formatINR(m.balance)}` : `owes ${formatINR(-m.balance)}`}
                      </span>
                    </li>
                  ))}
                </ul>
                <h3 className="mt-5 text-xs font-medium uppercase tracking-wider text-ink-500">Simplest way to settle</h3>
                <ul className="mt-2 divide-y divide-line">
                  {group.suggestedPayments.map((p) => (
                    <li key={`${p.fromMemberId}-${p.toMemberId}`} className="flex items-center gap-2 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 flex items-center gap-1.5 text-ink-700">
                        <span className="truncate">{nameOf(p.fromMemberId)}</span>
                        <ArrowRight size={13} className="shrink-0 text-ink-400" />
                        <span className="truncate">{nameOf(p.toMemberId)}</span>
                      </span>
                      <span className="shrink-0 tabular-nums font-medium text-ink-900">{formatINR(p.amount)}</span>
                      {!group.archived && (
                        <button onClick={() => openPanel({ kind: "settle", suggestion: p })} className="shrink-0 ml-1 text-xs font-medium text-brand-600 hover:underline">
                          Record
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="bg-surface border border-line rounded-2xl">
            <h2 className="px-5 pt-5 font-semibold text-ink-900">Members</h2>
            <ul className="mt-2 divide-y divide-line">
              {[...active, ...invited].map((m) => (
                <MemberRow key={m.id} groupId={group.id} member={m} onChanged={load} />
              ))}
            </ul>
          </section>
          <AddMemberForm groupId={group.id} onAdded={load} />
        </div>
      </div>
    </main>
  );
}
