import { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { isAxiosError } from "axios";
import api from "../lib/api";
import { pageWidth } from "../lib/ui";
import { useToast } from "../lib/toast";

// Shown under the header until the user confirms their email
function VerifyEmailBanner({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const toast = useToast();

  const resend = async () => {
    setSending(true);
    try {
      const res = await api.post("/auth/resend-verification");
      toast({ message: res.data.message });
    } catch (err) {
      toast({ message: (isAxiosError(err) && err.response?.data?.error) || "We couldn't send the link. Please try again." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-brand-50 border-b border-brand-100">
      <div className={`${pageWidth} py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm`}>
        <p className="flex items-start gap-2 text-ink-700 min-w-0">
          <MailCheck size={16} className="text-brand-700 shrink-0 mt-0.5" />
          <span className="min-w-0">
            Confirm your email: we sent a link to <span className="font-medium text-ink-900 break-words">{email}</span>.
            {/* The reason is left out on phones, where the banner would take up too much room */}
            <span className="hidden sm:inline"> You'll need it to post in Discuss and to get reply emails.</span>
          </span>
        </p>
        <button
          onClick={resend}
          disabled={sending}
          className="font-medium text-brand-700 hover:underline underline-offset-2 disabled:opacity-60 disabled:cursor-wait"
        >
          {sending ? "Sending…" : "Send a new link"}
        </button>
        <Link to="/settings/security" className="font-medium text-ink-500 hover:text-ink-900">
          Wrong address? Change it
        </Link>
      </div>
    </div>
  );
}

export default VerifyEmailBanner;
