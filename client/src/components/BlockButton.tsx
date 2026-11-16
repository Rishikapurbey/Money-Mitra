import { useState } from "react";
import { isAxiosError } from "axios";
import api from "../lib/api";
import { useToast } from "../lib/toast";

// Block or unblock someone. Blocking asks once more first, and isn't shown to the other person.
function BlockButton({ username, name, blocked, onChange }: { username: string; name: string; blocked: boolean; onChange: () => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = async (block: boolean) => {
    setBusy(true);
    try {
      if (block) await api.post(`/blocks/${username}`);
      else await api.delete(`/blocks/${username}`);
      toast({ message: block ? `${name} is blocked` : `${name} is unblocked` });
      setConfirming(false);
      onChange();
    } catch (err) {
      toast({ message: (isAxiosError(err) && err.response?.data?.error) || "That didn't work. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  if (blocked) {
    return (
      <button
        onClick={() => apply(false)}
        disabled={busy}
        className="inline-flex items-center px-4 py-2.5 rounded-xl border border-line text-sm font-medium text-ink-900 hover:bg-ink-100 disabled:opacity-60 transition"
      >
        Unblock
      </button>
    );
  }
  if (confirming) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-ink-500">They won't be able to message, follow or find you.</span>
        <button onClick={() => apply(true)} disabled={busy} className="font-medium text-loss hover:underline">
          Block
        </button>
        <button onClick={() => setConfirming(false)} className="text-ink-500 hover:underline">
          Cancel
        </button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className="px-2 py-2.5 text-sm text-ink-500 hover:text-ink-900 transition">
      Block
    </button>
  );
}

export default BlockButton;
