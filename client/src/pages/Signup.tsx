import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import AuthLayout, { authInputClass } from "../components/AuthLayout";

function Signup() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/auth/signup", { email, username, password });
      navigate("/login");
    } catch (err: any) {
      setError(err.response?.data?.error || "Signup failed");
    }
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
            className={`${authInputClass} mt-1.5`}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Password</span>
          <input
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${authInputClass} mt-1.5`}
            required
          />
        </label>
        <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 transition">
          Create account
        </button>
        <p className="text-sm pt-2 text-center text-ink-500">
          Already have an account? <Link to="/login" className="text-brand-600 font-medium hover:text-brand-700">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default Signup;
