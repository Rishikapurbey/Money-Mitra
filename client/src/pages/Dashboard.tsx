import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  note?: string;
  date: string;
}

function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/transactions", { amount: parseFloat(amount), type, category, note });
    setAmount("");
    setCategory("");
    setNote("");
    loadData();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-blue-600">Money Mitra</h1>
          <button onClick={handleLogout} className="text-sm text-red-500">Log out</button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded shadow text-center">
            <p className="text-sm text-gray-500">Income</p>
            <p className="text-lg font-bold text-green-600">₹{summary.income}</p>
          </div>
          <div className="bg-white p-4 rounded shadow text-center">
            <p className="text-sm text-gray-500">Expense</p>
            <p className="text-lg font-bold text-red-500">₹{summary.expense}</p>
          </div>
          <div className="bg-white p-4 rounded shadow text-center">
            <p className="text-sm text-gray-500">Balance</p>
            <p className="text-lg font-bold text-blue-600">₹{summary.balance}</p>
          </div>
        </div>

        <form onSubmit={handleAdd} className="bg-white p-4 rounded shadow mb-6 space-y-3">
          <h2 className="font-semibold">Add Transaction</h2>
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border rounded px-3 py-2 flex-1"
              required
            />
            <select value={type} onChange={(e) => setType(e.target.value)} className="border rounded px-3 py-2">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Category (e.g. Food, Rent, Salary)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Add
          </button>
        </form>

        <div className="bg-white rounded shadow">
          <h2 className="font-semibold p-4 border-b">Recent Transactions</h2>
          {transactions.length === 0 && <p className="p-4 text-gray-500 text-sm">No transactions yet.</p>}
          {transactions.map((t) => (
            <div key={t.id} className="flex justify-between p-4 border-b last:border-0">
              <div>
                <p className="font-medium">{t.category}</p>
                {t.note && <p className="text-sm text-gray-500">{t.note}</p>}
              </div>
              <p className={t.type === "income" ? "text-green-600" : "text-red-500"}>
                {t.type === "income" ? "+" : "-"}₹{t.amount}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;