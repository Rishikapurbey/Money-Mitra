import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Wallet, LogOut, TrendingUp, TrendingDown, Wallet2, Pencil, Trash2, Plus } from "lucide-react";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  note?: string;
  date: string;
}

const COLORS = ["#4f46e5", "#f97316", "#10b981", "#ec4899", "#eab308", "#06b6d4"];

function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const [txRes, summaryRes] = await Promise.all([
        api.get("/transactions"),
        api.get("/transactions/summary"),
      ]);
      setTransactions(txRes.data.transactions);
      setSummary(summaryRes.data.summary);
    } catch (err) {
      navigate("/login");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setAmount("");
    setCategory("");
    setNote("");
    setType("expense");
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await api.put(`/transactions/${editingId}`, { amount: parseFloat(amount), type, category, note });
    } else {
      await api.post("/transactions", { amount: parseFloat(amount), type, category, note });
    }
    resetForm();
    loadData();
  };

  const handleEdit = (t: Transaction) => {
    setEditingId(t.id);
    setAmount(String(t.amount));
    setType(t.type);
    setCategory(t.category);
    setNote(t.note || "");
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/transactions/${id}`);
    loadData();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const categories = Array.from(new Set(transactions.map((t) => t.category)));

  const filtered = transactions.filter((t) => {
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    return true;
  });

  const chartData = Object.values(
    transactions
      .filter((t) => t.type === "expense")
      .reduce((acc: Record<string, { name: string; value: number }>, t) => {
        if (!acc[t.category]) acc[t.category] = { name: t.category, value: 0 };
        acc[t.category].value += t.amount;
        return acc;
      }, {})
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Wallet className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold text-gray-800">Money Mitra</h1>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-500 transition">
            <LogOut size={16} /> Log out
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-gray-400 text-xs font-medium mb-1">
              <TrendingUp size={14} /> INCOME
            </div>
            <p className="text-2xl font-bold text-emerald-600">₹{summary.income}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-gray-400 text-xs font-medium mb-1">
              <TrendingDown size={14} /> EXPENSE
            </div>
            <p className="text-2xl font-bold text-rose-500">₹{summary.expense}</p>
          </div>
          <div className="bg-indigo-600 p-5 rounded-2xl shadow-md shadow-indigo-200">
            <div className="flex items-center gap-2 text-indigo-200 text-xs font-medium mb-1">
              <Wallet2 size={14} /> BALANCE
            </div>
            <p className="text-2xl font-bold text-white">₹{summary.balance}</p>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <h2 className="font-semibold text-gray-700 mb-2">Spending by Category</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6 space-y-3">
          <h2 className="font-semibold text-gray-700">{editingId ? "Edit Transaction" : "Add Transaction"}</h2>
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2.5 flex-1 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              required
            />
            <select value={type} onChange={(e) => setType(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-400">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Category (e.g. Food, Rent, Salary)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
            required
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
          />
          <div className="flex gap-2 pt-1">
            <button type="submit" className="flex items-center gap-1 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition shadow-md shadow-indigo-200">
              <Plus size={16} /> {editingId ? "Save Changes" : "Add"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="flex gap-3 mb-3">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400">
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <h2 className="font-semibold text-gray-700 p-5 border-b border-gray-100">Transactions</h2>
          {filtered.length === 0 && <p className="p-5 text-gray-400 text-sm">No transactions found.</p>}
          {filtered.map((t) => (
            <div key={t.id} className="flex justify-between items-center px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
              <div>
                <p className="font-medium text-gray-700">{t.category}</p>
                {t.note && <p className="text-sm text-gray-400">{t.note}</p>}
              </div>
              <div className="flex items-center gap-4">
                <p className={t.type === "income" ? "text-emerald-600 font-semibold" : "text-rose-500 font-semibold"}>
                  {t.type === "income" ? "+" : "-"}₹{t.amount}
                </p>
                <button onClick={() => handleEdit(t)} className="text-gray-300 hover:text-indigo-600 transition">
                  <Pencil size={16} />
                </button>
                <button onClick={() => handleDelete(t.id)} className="text-gray-300 hover:text-rose-500 transition">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;