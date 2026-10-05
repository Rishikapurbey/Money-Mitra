import { MailCheck } from "lucide-react";
import { useResendVerification } from "../lib/verifyEmail";

// Shown above Discuss forms before someone has confirmed their email, so they know before writing
function ConfirmEmailNotice({ action }: { action: string }) {
  const { sending, resend } = useResendVerification();
  return (
    <div className="flex items-start gap-3 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-sm">
      <MailCheck size={16} className="text-brand-700 shrink-0 mt-0.5" />
      <p className="text-ink-700">
        Confirm your email to {action}. Open the link we sent you, then come back here.{" "}
        <button
          type="button"
          onClick={resend}
          disabled={sending}
          className="font-medium text-brand-700 hover:underline underline-offset-2 disabled:opacity-60 disabled:cursor-wait"
        >
          {sending ? "Sending…" : "Send a new link"}
        </button>
      </p>
    </div>
  );
}

export default ConfirmEmailNotice;
