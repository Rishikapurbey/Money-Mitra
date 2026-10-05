import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { Lock, UsersRound } from "lucide-react";
import api from "../lib/api";
import { useTitle } from "../lib/useTitle";
import { useSubmit } from "../lib/useSubmit";
import { pageWidth } from "../lib/ui";

interface Preview {
  groupId: string;
  groupName: string;
  spotName: string;
  memberCount: number;
  alreadyMember: boolean;
}

// Opened from a link a group member sent: takes over the spot they added by name
export default function JoinGroup() {
  useTitle("Join a group");
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [problem, setProblem] = useState("");
  const { submitting, error, run } = useSubmit("We couldn't add you to the group. Please try again.");

  useEffect(() => {
    api
      .get(`/shared/join/${encodeURIComponent(token)}`)
      .then((res) => setPreview(res.data))
      .catch((err) =>
        setProblem(
          isAxiosError(err) && err.response?.status === 404
            ? "This link has expired or was already used. Ask the person who sent it for a new one."
            : "We couldn't open this link. Please try again."
        )
      );
  }, [token]);

  const join = () =>
    run(async () => {
      const res = await api.post(`/shared/join/${encodeURIComponent(token)}`);
      navigate(`/shared/${res.data.groupId}`, { replace: true });
    });

  return (
    <main className={`${pageWidth} py-12`}>
      <div className="max-w-lg mx-auto bg-surface border border-line rounded-2xl p-8 text-center">
        <span className="mx-auto w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center">
          <UsersRound size={22} />
        </span>
        {problem ? (
          <>
            <p className="mt-4 text-ink-700">{problem}</p>
            <Link to="/shared" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline">
              Go to shared expenses
            </Link>
          </>
        ) : !preview ? (
          <div aria-busy="true" className="mt-4 h-16 rounded-xl bg-ink-100 animate-pulse" />
        ) : preview.alreadyMember ? (
          <>
            <h1 className="mt-4 text-xl font-semibold text-ink-900">You're already in {preview.groupName}</h1>
            <Link to={`/shared/${preview.groupId}`} className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline">
              Open the group
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-semibold text-ink-900">Join {preview.groupName}</h1>
            <p className="mt-2 text-sm text-ink-500">
              You were added to this group as <span className="font-medium text-ink-900">{preview.spotName}</span>. Joining links that
              spot to your account, so you can see what's been shared. {preview.memberCount}{" "}
              {preview.memberCount === 1 ? "person is" : "people are"} in the group.
            </p>
            {error && <p role="alert" className="mt-4 text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}
            <button
              onClick={join}
              disabled={submitting}
              className="mt-6 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60"
            >
              {submitting ? "Joining…" : `Join as ${preview.spotName}`}
            </button>
            <p className="mt-4 flex items-start justify-center gap-2 text-xs text-ink-500">
              <Lock size={13} className="shrink-0 mt-0.5" /> Members only see what's added to the group, never your own Tracker.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
