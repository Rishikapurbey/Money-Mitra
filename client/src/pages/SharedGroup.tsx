import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { Archive, ArchiveRestore, ArrowLeft, Link2, LogOut, Pencil, Trash2, UserPlus, X } from "lucide-react";
import api from "../lib/api";
import { useTitle } from "../lib/useTitle";
import { useToast } from "../lib/toast";
import { inputClass, pageWidth } from "../lib/ui";
import { joinLink } from "../lib/shared";
import type { GroupMember, GroupSummary } from "../lib/shared";
import Avatar from "../components/Avatar";

const errorText = (err: unknown, fallback: string) => (isAxiosError(err) && err.response?.data?.error) || fallback;

const primaryButton =
  "bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed";

function subtitle(m: GroupMember) {
  if (m.status === "invited") return "Invited, hasn't joined yet";
  if (!m.person) return m.linkShared ? "Not on Money Mitra · join link made" : "Not on Money Mitra";
  return m.isMe ? `You · @${m.person.username}` : `@${m.person.username}`;
}

function MemberRow({ groupId, member, onChanged }: { groupId: string; member: GroupMember; onChanged: () => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  // Shown when the browser won't copy, so the link can be copied by hand
  const [link, setLink] = useState("");

  const copyLink = async () => {
    try {
      const res = await api.post(`/shared/groups/${groupId}/members/${member.id}/link`);
      const url = joinLink(res.data.token);
      try {
        await navigator.clipboard.writeText(url);
        toast({ message: `Link copied. Send it to ${member.name} so they can join.` });
      } catch {
        setLink(url);
      }
      if (!member.linkShared) onChanged();
    } catch (err) {
      toast({ message: errorText(err, "We couldn't make a link. Please try again.") });
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/shared/groups/${groupId}/members/${member.id}`);
      toast({ message: member.status === "invited" ? `Invite to ${member.name} cancelled` : `${member.name} removed` });
      onChanged();
    } catch (err) {
      setConfirming(false);
      toast({ message: errorText(err, "We couldn't do that. Please try again.") });
    }
  };

  const removable = member.status === "invited" || !member.person;

  return (
    <li className="px-5 py-3.5">
      <div className="flex items-center gap-3">
        {member.person ? (
          <Link to={`/u/${member.person.username}`} className="shrink-0">
            <Avatar name={member.name} avatarUrl={member.person.avatarUrl} size="lg" />
          </Link>
        ) : (
          <span aria-hidden="true" className="w-10 h-10 shrink-0 rounded-full bg-ink-100 text-ink-500 font-semibold flex items-center justify-center">
            {member.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className={`font-medium truncate ${member.status === "invited" ? "text-ink-500" : "text-ink-900"}`}>{member.name}</p>
          <p className="text-sm text-ink-500 truncate">{subtitle(member)}</p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {!member.person && (
            <button onClick={copyLink} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
              <Link2 size={15} /> <span className="hidden sm:inline">Copy join link</span>
              <span className="sm:hidden">Link</span>
            </button>
          )}
          {removable && (
            <button
              onClick={() => setConfirming(true)}
              aria-label={member.status === "invited" ? `Cancel invite to ${member.name}` : `Remove ${member.name}`}
              className="text-ink-300 hover:text-loss transition"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
      {link && (
        <div className="mt-3 flex items-center gap-2">
          <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Join link" className={`${inputClass} py-1.5 text-sm flex-1 min-w-0`} />
          <button onClick={() => setLink("")} aria-label="Close" className="text-ink-400 hover:text-ink-900">
            <X size={16} />
          </button>
        </div>
      )}
      {confirming && (
        <div className="mt-3 rounded-xl bg-canvas border border-line p-3 text-sm">
          <p className="text-ink-700">
            {member.status === "invited" ? `Cancel the invite to ${member.name}?` : `Remove ${member.name} from the group?`}
          </p>
          <div className="mt-2 flex gap-3">
            <button onClick={remove} className="font-medium text-loss hover:underline">
              {member.status === "invited" ? "Cancel invite" : "Remove"}
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

function AddMemberForm({ groupId, onAdded }: { groupId: string; onAdded: () => void }) {
  const toast = useToast();
  const [onApp, setOnApp] = useState(true);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post(`/shared/groups/${groupId}/members`, onApp ? { username: value } : { name: value });
      toast({ message: onApp ? `Invite sent to ${res.data.member.name}` : `${res.data.member.name} added` });
      setValue("");
      onAdded();
    } catch (err) {
      setError(errorText(err, "We couldn't add them. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-surface border border-line rounded-2xl p-6 space-y-4">
      <h2 className="font-semibold text-ink-900">Add someone</h2>
      <div role="radiogroup" aria-label="Are they on Money Mitra?" className="grid grid-cols-2 p-1 bg-ink-100 rounded-xl text-sm font-medium">
        {[
          { value: true, label: "On Money Mitra" },
          { value: false, label: "Not on the app" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={onApp === o.value}
            onClick={() => {
              setOnApp(o.value);
              setError("");
            }}
            className={`py-2 rounded-lg transition ${onApp === o.value ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <label className="block text-sm font-medium text-ink-700">
        {onApp ? "Their username" : "Their name"}
        <div className="relative mt-1">
          {onApp && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 font-normal">@</span>}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={onApp ? 21 : 40}
            required
            autoCapitalize={onApp ? "none" : "words"}
            autoCorrect="off"
            placeholder={onApp ? "username" : "e.g. Ravi"}
            className={`${inputClass} w-full font-normal ${onApp ? "!pl-8" : ""}`}
          />
        </div>
      </label>
      <p className="text-xs text-ink-500">
        {onApp
          ? "They'll get an invite and join once they accept."
          : "Only the group keeps track of their share. You can send them a link later so they can join and take over their spot."}
      </p>
      {error && <p role="alert" className="text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}
      <button type="submit" disabled={busy} className={`${primaryButton} inline-flex items-center gap-2`}>
        <UserPlus size={16} /> {busy ? "Adding…" : onApp ? "Send invite" : "Add"}
      </button>
    </form>
  );
}

export default function SharedGroup() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [loadError, setLoadError] = useState<"missing" | "failed" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [leaving, setLeaving] = useState(false);
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setArchived(!group.archived)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-ink-700 border border-line bg-surface hover:bg-ink-100 transition"
            >
              {group.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />} {group.archived ? "Unarchive" : "Archive"}
            </button>
            <button
              onClick={() => setLeaving(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-ink-700 border border-line bg-surface hover:bg-ink-100 transition"
            >
              <LogOut size={15} /> Leave
            </button>
          </div>
        </div>
        {leaving && (
          <div className="rounded-xl bg-surface border border-line p-4 text-sm">
            <p className="text-ink-700">
              Leave {group.name}? It disappears from your list. A member can invite you back later.
              {active.filter((m) => m.person).length === 1 && " You're the last person here on Money Mitra, so the group will be deleted."}
            </p>
            <div className="mt-2 flex gap-3">
              <button onClick={leave} className="font-medium text-loss hover:underline">
                Leave group
              </button>
              <button onClick={() => setLeaving(false)} className="text-ink-500 hover:text-ink-900">
                Stay
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <section className="bg-surface border border-line rounded-2xl min-w-0">
          <h2 className="px-5 pt-5 font-semibold text-ink-900">Members</h2>
          <ul className="mt-2 divide-y divide-line">
            {[...active, ...invited].map((m) => (
              <MemberRow key={m.id} groupId={group.id} member={m} onChanged={load} />
            ))}
          </ul>
        </section>
        <AddMemberForm groupId={group.id} onAdded={load} />
      </div>
    </main>
  );
}
