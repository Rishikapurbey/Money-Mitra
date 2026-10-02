import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { isAxiosError } from "axios";
import api from "../lib/api";
import AuthLayout from "../components/AuthLayout";
import { useTitle } from "../lib/useTitle";

const buttonClass = "block w-full text-center bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 transition";

function VerifyEmail() {
  useTitle("Confirm your email");
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<"checking" | "done" | "failed">(token ? "checking" : "failed");
  const [error, setError] = useState("");
  const [changedTo, setChangedTo] = useState<string | null>(null);
  // React runs effects twice in development; the link should only be sent once
  const sent = useRef(false);
  const signedIn = Boolean(localStorage.getItem("token"));

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    api
      .post("/auth/verify-email", { token })
      .then((res) => {
        setChangedTo(res.data.changedTo);
        setState("done");
      })
      .catch((err) => {
        setError(
          isAxiosError(err) && !err.response
            ? "We can't reach the server right now. Please open the link again in a moment."
            : (isAxiosError(err) && err.response?.data?.error) || "We couldn't confirm your email."
        );
        setState("failed");
      });
  }, [token]);

  const next = signedIn ? (
    <Link to="/home" className={buttonClass}>
      Go to Money Mitra
    </Link>
  ) : (
    <Link to="/login" className={buttonClass}>
      Log in
    </Link>
  );

  if (state === "checking") {
    return (
      <AuthLayout title="Confirming your email" subtitle="This only takes a moment.">
        <p className="text-sm text-ink-500">Checking your link…</p>
      </AuthLayout>
    );
  }

  if (state === "done") {
    return (
      <AuthLayout
        title={changedTo ? "Email changed" : "Email confirmed"}
        subtitle={changedTo ? "From now on, log in with your new email address." : "Thanks. You can now post in Discuss and get reply emails."}
      >
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-gain font-medium">
            <CheckCircle2 size={16} /> {changedTo ? `Your email is now ${changedTo}.` : "Your email address is confirmed."}
          </p>
          {next}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="We couldn't confirm your email"
      subtitle={token ? error : "This link isn't complete. Open the link from your email again."}
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-500">
          {signedIn
            ? "You can send yourself a new link from the banner at the top of the app."
            : "Log in and you can send yourself a new link from the banner at the top of the app."}
        </p>
        {next}
      </div>
    </AuthLayout>
  );
}

export default VerifyEmail;
