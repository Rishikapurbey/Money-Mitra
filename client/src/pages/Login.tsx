import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import AuthLayout, { authInputClass } from "../components/AuthLayout";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.token);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
    }
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
          <span className="text-sm font-medium text-ink-700">Password</span>
          <input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${authInputClass} mt-1.5`}
            required
          />
        </label>
        <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 transition">
          Log in
        </button>
        <p className="text-sm pt-2 text-center text-ink-500">
          No account? <Link to="/signup" className="text-brand-600 font-medium hover:text-brand-700">Create one</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default Login;
