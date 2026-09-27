import { useState } from "react";
import { isAxiosError } from "axios";
import { Flag } from "lucide-react";
import api from "../lib/api";
import { REPORT_REASONS } from "../lib/discuss";

interface ReportButtonProps {
  // API path of the question or reply, e.g. /posts/123 or /posts/123/replies/456
  path: string;
  // Called when this report pushed the item over the hiding threshold
  onHidden: () => void;
}

// A small flag button that opens an inline list of reasons (no pop-up dialogs)
function ReportButton({ path, onHidden }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async () => {
    setState("sending");
    try {
      const res = await api.post(`${path}/report`, { reason });
      setState("done");
      setMessage("Thanks for letting us know. We'll take a look.");
      if (res.data.hidden) onHidden();
    } catch (err) {
      // Already reported: still a "done" state for the person reporting
      if (isAxiosError(err) && err.response?.status === 409) {
        setState("done");
        setMessage(err.response.data.error);
      } else {
        setState("error");
        setMessage((isAxiosError(err) && err.response?.data?.error) || "We couldn't send your report. Please try again.");
      }
    }
  };

  if (state === "done") return <p className="text-xs text-ink-500">{message}</p>;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-loss transition"
      >
        <Flag size={13} /> Report
      </button>
    );
  }

  return (
    <div className="mt-2 w-full bg-canvas border border-line rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-ink-900">Why are you reporting this?</p>
      <div className="space-y-2">
        {REPORT_REASONS.map((r) => (
          <label key={r.key} className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
            <input
              type="radio"
              name={`reason-${path}`}
              value={r.key}
              checked={reason === r.key}
              onChange={() => setReason(r.key)}
              className="accent-brand-600"
            />
            {r.label}
          </label>
        ))}
      </div>
      {state === "error" && <p className="text-xs text-loss">{message}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={!reason || state === "sending"}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-loss text-white hover:opacity-90 transition disabled:opacity-50"
        >
          {state === "sending" ? "Sending…" : "Send report"}
        </button>
        <button onClick={() => setOpen(false)} className="px-4 py-1.5 rounded-lg text-sm text-ink-700 hover:bg-ink-100 transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default ReportButton;
