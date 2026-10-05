import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { ChevronRight, Lock, Plus, UsersRound } from "lucide-react";
import api from "../lib/api";
import { useTitle } from "../lib/useTitle";
import { useToast } from "../lib/toast";
import { inputClass, pageWidth } from "../lib/ui";
import { announceNotificationsChange } from "../lib/dataEvents";
import { nameOf } from "../lib/me";
import { memberNames } from "../lib/shared";
import type { GroupInvite, GroupSummary } from "../lib/shared";
import Avatar from "../components/Avatar";

const errorText = (err: unknown, fallback: string) => (isAxiosError(err) && err.response?.data?.error) || fallback;

const primaryButton =
  "bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed";

function GroupRow({ group }: { group: GroupSummary }) {
  return (
    <li>
      <Link to={`/shared/${group.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-canvas transition group">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
          <UsersRound size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink-900 truncate group-hover:underline">{group.name}</span>
          <span className="block text-sm text-ink-500 truncate">{memberNames(group.members)}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-ink-300" />
      </Link>
    </li>
  );
}

// Shared groups the user is in, invites waiting for an answer, and a way to start a group
export default function SharedGroups() {
  useTitle("Shared expenses");
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<{ groups: GroupSummary[]; invites: GroupInvite[] } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [answering, setAnswering] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(() => {
    api
      .get("/shared/groups")
      .then((res) => {
        setData(res.data);
        setLoadError("");
      })
      .catch(() => setLoadError("We couldn't load your groups. Please try again."));
  }, []);

  useEffect(load, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError("");
    try {
      const res = await api.post("/shared/groups", { name });
      navigate(`/shared/${res.data.group.id}`);
    } catch (err) {
      setFormError(errorText(err, "We couldn't create the group. Please try again."));
      setCreating(false);
    }
  };

  const answer = async (invite: GroupInvite, accept: boolean) => {
    setAnswering(invite.id);
    try {
      if (accept) {
        const res = await api.post(`/shared/invites/${invite.id}/accept`);
        announceNotificationsChange();
        navigate(`/shared/${res.data.groupId}`);
        return;
      }
      await api.delete(`/shared/invites/${invite.id}`);
      announceNotificationsChange();
      toast({ message: `Invite to ${invite.groupName} declined` });
      load();
    } catch (err) {
      toast({ message: errorText(err, "We couldn't do that. Please try again.") });
    } finally {
      setAnswering(null);
    }
  };

  const active = data?.groups.filter((g) => !g.archived) ?? [];
  const archived = data?.groups.filter((g) => g.archived) ?? [];

  return (
    <main className={`${pageWidth} py-8 space-y-6`}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Shared expenses</h1>
        <p className="mt-1 text-sm text-ink-500">Split costs for trips, flats and outings, and keep track of who owes whom.</p>
      </div>

      {loadError ? (
        <div role="alert" className="flex items-center gap-3 bg-loss-soft text-loss px-4 py-3 rounded-xl text-sm">
          <span className="flex-1">{loadError}</span>
          <button onClick={load} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data ? (
        <div aria-busy="true" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="h-44 rounded-2xl bg-ink-100 animate-pulse" />
          <div className="h-44 rounded-2xl bg-ink-100 animate-pulse" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
          <div className="space-y-6 min-w-0">
            {data.invites.length > 0 && (
              <section className="bg-surface border border-line rounded-2xl">
                <h2 className="px-5 pt-5 font-semibold text-ink-900">Invites</h2>
                <ul className="divide-y divide-line">
                  {data.invites.map((invite) => (
                    <li key={invite.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                      {invite.invitedBy && <Avatar name={nameOf(invite.invitedBy)} avatarUrl={invite.invitedBy.avatarUrl} size="lg" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink-900 truncate">{invite.groupName}</p>
                        <p className="text-sm text-ink-500">
                          {invite.invitedBy ? `${nameOf(invite.invitedBy)} invited you` : "You're invited"} · {invite.memberCount}{" "}
                          {invite.memberCount === 1 ? "member" : "members"}
                        </p>
                      </div>
                      <div className="flex gap-2 w-full pl-[52px] sm:w-auto sm:pl-0">
                        <button
                          onClick={() => answer(invite, true)}
                          disabled={answering === invite.id}
                          className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition disabled:opacity-60"
                        >
                          Join
                        </button>
                        <button
                          onClick={() => answer(invite, false)}
                          disabled={answering === invite.id}
                          className="px-4 py-2 rounded-xl text-sm font-medium text-ink-700 border border-line hover:bg-ink-100 transition disabled:opacity-60"
                        >
                          Decline
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="bg-surface border border-line rounded-2xl">
              <h2 className="px-5 pt-5 font-semibold text-ink-900">Your groups</h2>
              {active.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <UsersRound size={28} className="mx-auto text-ink-300" />
                  <p className="mt-3 text-sm text-ink-500">No groups yet. Start one for your next trip or your flat.</p>
                </div>
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {active.map((g) => (
                    <GroupRow key={g.id} group={g} />
                  ))}
                </ul>
              )}
              {archived.length > 0 && (
                <div className="border-t border-line">
                  <button
                    onClick={() => setShowArchived((s) => !s)}
                    aria-expanded={showArchived}
                    className="w-full px-5 py-3 text-left text-sm text-ink-500 hover:text-ink-900 transition"
                  >
                    {showArchived ? "Hide" : "Show"} archived groups ({archived.length})
                  </button>
                  {showArchived && (
                    <ul className="divide-y divide-line border-t border-line">
                      {archived.map((g) => (
                        <GroupRow key={g.id} group={g} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </div>

          <form onSubmit={create} className="bg-surface border border-line rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-ink-900">Start a group</h2>
            <label className="block text-sm font-medium text-ink-700">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
                placeholder="e.g. Goa trip, Flat 4B"
                className={`${inputClass} w-full mt-1 font-normal`}
              />
            </label>
            {formError && <p role="alert" className="text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">{formError}</p>}
            <button type="submit" disabled={creating} className={`${primaryButton} inline-flex items-center gap-2`}>
              <Plus size={16} /> {creating ? "Creating…" : "Create group"}
            </button>
            <p className="flex items-start gap-2 text-xs text-ink-500">
              <Lock size={13} className="shrink-0 mt-0.5" /> Members only see what's added to the group. Your own Tracker stays private.
            </p>
          </form>
        </div>
      )}
    </main>
  );
}
