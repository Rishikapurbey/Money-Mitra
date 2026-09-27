import { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import api from "../lib/api";
import AuthLayout, { authInputClass } from "../components/AuthLayout";
import { useSubmit } from "../lib/useSubmit";
import { useTitle } from "../lib/useTitle";

function ForgotPassword() {
  useTitle("Forgot password");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { submitting, slow, error, run } = useSubmit("We couldn't send the reset link");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    });
  };

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle="If an account exists for that email, we've sent a link to reset your password.">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-brand-50 text-ink-700 p-4 rounded-xl text-sm">
            <MailCheck size={20} className="text-brand-600 shrink-0" />
            <p>
              The link expires in 30 minutes. If you don't see the email in a few minutes, check your spam folder.
            </p>
          </div>
          <p className="text-sm text-center text-ink-500">
            <Link to="/login" className="text-brand-600 font-medium hover:text-brand-700">Back to log in</Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your account email and we'll send you a link to choose a new one.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-loss text-sm bg-loss-soft px-3 py-2 rounded-lg">{error}</p>}
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Email</span>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${authInputClass} mt-1.5`}
            required
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-70 disabled:cursor-wait"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>
        {slow && (
          <p className="text-sm text-ink-500 text-center">
            Waking up the server. The first request can take up to a minute.
          </p>
        )}
        <p className="text-sm pt-2 text-center text-ink-500">
          Remembered it? <Link to="/login" className="text-brand-600 font-medium hover:text-brand-700">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default ForgotPassword;
