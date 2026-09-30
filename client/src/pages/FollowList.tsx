import { useEffect, useState } from "react";
import { Link, NavLink, useOutletContext, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { ArrowLeft, Lock, Users } from "lucide-react";
import api from "../lib/api";
import type { Person } from "../lib/profile";
import { pageWidth } from "../lib/ui";
import { useTitle } from "../lib/useTitle";
import { useToast } from "../lib/toast";
import FollowButton from "../components/FollowButton";
import PersonRow from "../components/PersonRow";
import type { AppContext } from "../components/AppLayout";

type Which = "followers" | "following";
type Result = { which: Which; username: string; people: Person[] } | { which: Which; username: string; problem: "private" | "not-found" | "error" };

async function fetchPeople(username: string, which: Which): Promise<Result> {
  try {
    const res = await api.get(`/users/${encodeURIComponent(username)}/${which}`);
    return { which, username, people: res.data.people };
  } catch (err) {
    const status = isAxiosError(err) ? err.response?.status : undefined;
    return { which, username, problem: status === 403 ? "private" : status === 404 ? "not-found" : "error" };
  }
}

// Someone's followers, or the people they follow. On your own followers list you can remove people.
function FollowList({ which }: { which: Which }) {
  const { username = "" } = useParams();
  const { me } = useOutletContext<AppContext>();
  const toast = useToast();
  const [result, setResult] = useState<Result | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  useTitle(`${which === "followers" ? "Followers" : "Following"} · @${username}`);
  const ownFollowers = which === "followers" && me?.username.toLowerCase() === username.toLowerCase();

  useEffect(() => {
    let current = true;
    fetchPeople(username, which).then((r) => current && setResult(r));
    return () => {
      current = false;
    };
  }, [username, which]);

  // Ignore a list left over from the previous address until the new one arrives
  const shown = result && result.which === which && result.username === username ? result : null;

  const setPerson = (name: string, changes: Partial<Person> | null) =>
    setResult((r) =>
      r && "people" in r
        ? { ...r, people: changes ? r.people.map((p) => (p.username === name ? { ...p, ...changes } : p)) : r.people.filter((p) => p.username !== name) }
        : r
    );

  const remove = async (name: string) => {
    try {
      await api.delete(`/follows/followers/${encodeURIComponent(name)}`);
      setPerson(name, null);
      toast({ message: `Removed @${name} from your followers` });
    } catch {
      toast({ message: "We couldn't remove them. Please try again." });
    }
    setConfirmRemove(null);
  };

  const tab = (to: Which, label: string) => (
    <NavLink
      to={`/u/${username}/${to}`}
      replace
      className={({ isActive }) =>
        `py-2 rounded-lg text-center transition ${isActive ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`
      }
    >
      {label}
    </NavLink>
  );

  let body;
  if (!shown) {
    body = <div className="h-40 bg-surface border border-line rounded-2xl animate-pulse" />;
  } else if ("problem" in shown) {
    const messages = {
      private: { icon: Lock, title: "This profile is private", text: "Only followers they've accepted can see who they follow and who follows them." },
      "not-found": { icon: Users, title: `We couldn't find @${username}`, text: "They may have changed their username or deleted their account." },
      error: { icon: Users, title: "We couldn't load this list", text: "Check your connection and try again." },
    };
    const { icon: Icon, title, text } = messages[shown.problem];
    body = (
      <div className="bg-surface border border-line rounded-2xl p-10 text-center">
        <Icon size={28} className="mx-auto text-ink-300" />
        <p className="mt-3 font-medium text-ink-900">{title}</p>
        <p className="mt-1 text-sm text-ink-500">{text}</p>
      </div>
    );
  } else if (shown.people.length === 0) {
    body = (
      <div className="bg-surface border border-line rounded-2xl p-10 text-center text-sm text-ink-500">
        {which === "followers" ? "No followers yet." : "Not following anyone yet."}
      </div>
    );
  } else {
    body = (
      <ul className="bg-surface border border-line rounded-2xl divide-y divide-line">
        {shown.people.map((p) => (
          <PersonRow key={p.username} person={p}>
            {ownFollowers &&
              (confirmRemove === p.username ? (
                <>
                  <button onClick={() => remove(p.username)} className="text-sm font-medium text-loss hover:underline">
                    Remove
                  </button>
                  <button onClick={() => setConfirmRemove(null)} className="text-sm text-ink-500 hover:text-ink-900">
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmRemove(p.username)}
                  title="They won't be told"
                  className="text-sm font-medium text-ink-500 hover:text-loss transition"
                >
                  Remove
                </button>
              ))}
            {!p.isMe && confirmRemove !== p.username && (
              <FollowButton username={p.username} status={p.followStatus} size="sm" onChange={(followStatus) => setPerson(p.username, { followStatus })} />
            )}
          </PersonRow>
        ))}
      </ul>
    );
  }

  return (
    <main className={`${pageWidth} py-8`}>
      <div className="max-w-3xl space-y-5">
        <Link to={`/u/${username}`} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition">
          <ArrowLeft size={16} /> @{username}
        </Link>
        <div className="grid grid-cols-2 p-1 bg-ink-100 rounded-xl text-sm font-medium max-w-sm">
          {tab("followers", "Followers")}
          {tab("following", "Following")}
        </div>
        {body}
        {ownFollowers && shown && "people" in shown && shown.people.length > 0 && (
          <p className="text-xs text-ink-500">Removing someone doesn't notify them.</p>
        )}
      </div>
    </main>
  );
}

export default FollowList;
