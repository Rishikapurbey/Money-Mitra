import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Wallet } from "lucide-react";
import api from "../lib/api";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-indigo-50 px-4">
      <form onSubmit={handleSubmit} className="bg-white p-10 rounded-3xl shadow-xl shadow-indigo-100 w-full max-w-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Wallet className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Money Mitra</h1>
        </div>
        <p className="text-gray-400 text-sm mb-6">Your friend for tracking and learning money.</p>
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
          required
        />
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
          required
        />
        <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition shadow-md shadow-indigo-200">
          Create Account
        </button>
        <p className="text-sm mt-5 text-center text-gray-500">
          Already have an account? <Link to="/login" className="text-indigo-600 font-medium">Log in</Link>
        </p>
      </form>
    </div>
  );
}

export default Signup;