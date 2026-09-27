import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import AuthLayout, { authInputClass } from "../components/AuthLayout";
import { useSubmit } from "../lib/useSubmit";

function Signup() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { submitting, slow, error, run } = useSubmit("Signup failed");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.post("/auth/signup", { email, username, password });
      navigate("/login");
    });
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start tracking and understanding your money.">
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
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Username</span>
          <input
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            pattern="[A-Za-z0-9_]{3,20}"
            title="3 to 20 characters: letters, numbers and underscores"
            className={`${authInputClass} mt-1.5`}
            required
          />
          <span className="mt-1 block text-xs text-ink-500">3 to 20 characters: letters, numbers and underscores.</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Password</span>
          <input
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={72}
            className={`${authInputClass} mt-1.5`}
            required
          />
          <span className="mt-1 block text-xs text-ink-500">At least 8 characters, with a letter and a number.</span>
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-70 disabled:cursor-wait"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
        {slow && (
          <p className="text-sm text-ink-500 text-center">
            Waking up the server. The first request can take up to a minute.
          </p>
        )}
        <p className="text-sm pt-2 text-center text-ink-500">
          Already have an account? <Link to="/login" className="text-brand-600 font-medium hover:text-brand-700">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default Signup;
