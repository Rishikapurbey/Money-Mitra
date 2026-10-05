import { useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { Link2, Trash2, UserPlus, X } from "lucide-react";
import api from "../../lib/api";
import { useToast } from "../../lib/toast";
import { inputClass } from "../../lib/ui";
import { joinLink } from "../../lib/shared";
import type { GroupMember } from "../../lib/shared";
import Avatar from "../Avatar";

const errorText = (err: unknown, fallback: string) => (isAxiosError(err) && err.response?.data?.error) || fallback;

const primaryButton =
  "bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed";

function subtitle(m: GroupMember) {
  if (m.status === "invited") return "Invited, hasn't joined yet";
  if (!m.person) return m.linkShared ? "Not on Money Mitra · join link made" : "Not on Money Mitra";
  return m.isMe ? `You · @${m.person.username}` : `@${m.person.username}`;
}

export function MemberRow({ groupId, member, onChanged }: { groupId: string; member: GroupMember; onChanged: () => void }) {
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

export function AddMemberForm({ groupId, onAdded }: { groupId: string; onAdded: () => void }) {
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
