import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import AuthLayout, { authInputClass } from "../components/AuthLayout";
import { useSubmit } from "../lib/useSubmit";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { submitting, slow, error, run } = useSubmit("Login failed");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.token);
      navigate("/dashboard");
    });
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to check in on your money.">
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
          <span className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-700">Password</span>
            <Link to="/forgot-password" className="text-sm text-brand-600 hover:text-brand-700">
              Forgot password?
            </Link>
          </span>
          <input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${authInputClass} mt-1.5`}
            required
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-70 disabled:cursor-wait"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
        {slow && (
          <p className="text-sm text-ink-500 text-center">
            Waking up the server. The first request can take up to a minute.
          </p>
        )}
        <p className="text-sm pt-2 text-center text-ink-500">
          No account? <Link to="/signup" className="text-brand-600 font-medium hover:text-brand-700">Create one</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default Login;
