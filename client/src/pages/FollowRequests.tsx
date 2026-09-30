import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ArrowLeft, UserPlus } from "lucide-react";
import api from "../lib/api";
import { timeAgo } from "../lib/discuss";
import { pageWidth } from "../lib/ui";
import { useTitle } from "../lib/useTitle";
import { useToast } from "../lib/toast";
import { announceNotificationsChange } from "../lib/dataEvents";
import PersonRow from "../components/PersonRow";
import type { AppContext } from "../components/AppLayout";

interface Request {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  requestedAt: string;
}

// People asking to follow your private profile
function FollowRequests() {
  useTitle("Follow requests");
  const { me } = useOutletContext<AppContext>();
  const toast = useToast();
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/follows/requests")
      .then((res) => setRequests(res.data.requests))
      .catch(() => setFailed(true));
  }, []);

  const answer = async (username: string, accept: boolean) => {
    setBusy(username);
    try {
      const name = encodeURIComponent(username);
      if (accept) await api.post(`/follows/requests/${name}/accept`);
      else await api.delete(`/follows/requests/${name}`);
      setRequests((current) => current?.filter((r) => r.username !== username) ?? null);
      announceNotificationsChange();
      toast({ message: accept ? `@${username} now follows you` : "Request declined" });
    } catch {
      toast({ message: "We couldn't do that. Please try again." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className={`${pageWidth} py-8`}>
      <div className="max-w-3xl space-y-5">
        {me && (
          <Link to={`/u/${me.username}`} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition">
            <ArrowLeft size={16} /> Your profile
          </Link>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Follow requests</h1>
          <p className="mt-1 text-sm text-ink-500">
            People you accept can see your questions, replies and followers. Declining doesn't notify them.
          </p>
        </div>
        {failed ? (
          <p role="alert" className="bg-loss-soft text-loss px-4 py-3 rounded-xl text-sm">
            We couldn't load your requests. Check your connection and try again.
          </p>
        ) : requests === null ? (
          <div className="h-32 bg-surface border border-line rounded-2xl animate-pulse" />
        ) : requests.length === 0 ? (
          <div className="bg-surface border border-line rounded-2xl p-10 text-center">
            <UserPlus size={28} className="mx-auto text-ink-300" />
            <p className="mt-3 text-sm text-ink-500">No requests waiting.</p>
          </div>
        ) : (
          <ul className="bg-surface border border-line rounded-2xl divide-y divide-line">
            {requests.map((r) => (
              <PersonRow key={r.username} person={r}>
                <span className="hidden sm:block text-xs text-ink-400">{timeAgo(r.requestedAt)}</span>
                <button
                  onClick={() => answer(r.username, true)}
                  disabled={busy === r.username}
                  className="px-3 py-1.5 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition disabled:opacity-60"
                >
                  Accept
                </button>
                <button
                  onClick={() => answer(r.username, false)}
                  disabled={busy === r.username}
                  className="px-3 py-1.5 rounded-xl text-sm font-medium border border-line text-ink-900 hover:bg-ink-100 transition disabled:opacity-60"
                >
                  Decline
                </button>
              </PersonRow>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

export default FollowRequests;
