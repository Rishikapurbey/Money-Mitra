import { useState } from "react";
import { Check, Clock, UserPlus } from "lucide-react";
import api from "../lib/api";
import type { FollowStatus } from "../lib/profile";
import { useToast } from "../lib/toast";

const base = "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition disabled:opacity-60";
const sizes = { md: "px-5 py-2.5 text-sm", sm: "px-3 py-1.5 text-sm" };

// Follow, Requested (tap to withdraw) or Following (tap, then confirm, to unfollow)
function FollowButton({
  username,
  status,
  onChange,
  size = "md",
}: {
  username: string;
  status: FollowStatus;
  onChange: (status: FollowStatus) => void;
  size?: keyof typeof sizes;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  const send = async (method: "post" | "delete") => {
    setBusy(true);
    try {
      const res = await api[method](`/follows/${encodeURIComponent(username)}`);
      onChange(res.data.followStatus);
    } catch {
      toast({ message: "We couldn't update that. Please try again." });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  if (status === "none") {
    return (
      <button onClick={() => send("post")} disabled={busy} className={`${base} ${sizes[size]} bg-brand-600 text-white hover:bg-brand-700`}>
        <UserPlus size={15} /> Follow
      </button>
    );
  }

  const quiet = `${base} ${sizes[size]} border border-line text-ink-900 hover:bg-ink-100`;
  if (status === "requested") {
    return (
      <button onClick={() => send("delete")} disabled={busy} title="Withdraw your request" className={quiet}>
        <Clock size={15} /> Requested
      </button>
    );
  }
  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <button onClick={() => send("delete")} disabled={busy} className={`${base} ${sizes[size]} bg-loss text-white hover:opacity-90`}>
          Unfollow
        </button>
        <button onClick={() => setConfirming(false)} className="text-sm font-medium text-ink-500 hover:text-ink-900">
          Cancel
        </button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} disabled={busy} className={quiet}>
      <Check size={15} /> Following
    </button>
  );
}

export default FollowButton;
