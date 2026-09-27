import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import api from "../lib/api";
import AuthLayout, { authInputClass } from "../components/AuthLayout";
import { useSubmit } from "../lib/useSubmit";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);
  const { submitting, slow, error, run } = useSubmit("We couldn't reset your password");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    run(async () => {
      await api.post("/auth/reset-password", { token, password });
      // Any old session on this browser was ended by the reset
      localStorage.removeItem("token");
      setDone(true);
    });
  };

  if (!token) {
    return (
      <AuthLayout title="This link isn't complete" subtitle="Open the link from your email again, or request a new one.">
        <Link to="/forgot-password" className="block w-full text-center bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 transition">
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password updated" subtitle="You can now log in with your new password.">
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-gain font-medium">
            <CheckCircle2 size={16} /> For your security, you've been logged out on all devices.
          </p>
          <Link to="/login" className="block w-full text-center bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 transition">
            Log in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Pick something you haven't used here before.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {(error || mismatch) && (
          <div className="text-loss text-sm bg-loss-soft px-3 py-2 rounded-lg">
            <p>{mismatch ? "The two passwords don't match." : error}</p>
            {error.includes("expired") && (
              <Link to="/forgot-password" className="mt-1 inline-block font-medium underline underline-offset-2">
                Request a new link
              </Link>
            )}
          </div>
        )}
        <label className="block">
          <span className="text-sm font-medium text-ink-700">New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={72}
            className={`${authInputClass} mt-1.5`}
            required
          />
          <span className="mt-1 block text-xs text-ink-500">At least 8 characters, with a letter and a number.</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`${authInputClass} mt-1.5`}
            required
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-70 disabled:cursor-wait"
        >
          {submitting ? "Saving…" : "Save new password"}
        </button>
        {slow && (
          <p className="text-sm text-ink-500 text-center">
            Waking up the server. The first request can take up to a minute.
          </p>
        )}
      </form>
    </AuthLayout>
  );
}

export default ResetPassword;
