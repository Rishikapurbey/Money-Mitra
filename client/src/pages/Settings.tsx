import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { isAxiosError } from "axios";
import { CheckCircle2, Download, FileJson, AlertTriangle } from "lucide-react";
import api from "../lib/api";
import { inputClass, pageWidth } from "../lib/ui";
import { useWideLayout } from "../lib/useMediaQuery";
import { csvField } from "../lib/csv";
import type { AppContext } from "../components/AppLayout";
import CategoriesCard from "../components/CategoriesCard";
import { setTheme, useTheme } from "../lib/theme";
import type { ThemeChoice } from "../lib/theme";
import { useTitle } from "../lib/useTitle";

const errorMessage = (err: unknown, fallback: string) =>
  (isAxiosError(err) && err.response?.data?.error) || fallback;


function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Card({ title, description, children, danger }: { title: string; description?: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className={`bg-surface border rounded-2xl p-6 ${danger ? "border-loss/40" : "border-line"}`}>
      <h2 className={`font-semibold ${danger ? "text-loss" : "text-ink-900"}`}>{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Status({ error, success }: { error: string; success: string }) {
  if (error) return <p className="text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">{error}</p>;
  if (success) {
    return (
      <p className="flex items-center gap-2 text-sm text-gain font-medium">
        <CheckCircle2 size={16} /> {success}
      </p>
    );
  }
  return null;
}

const button =
  "bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed";

function Settings() {
  useTitle("Settings");
  const { username, setUsername } = useOutletContext<AppContext>();
  const navigate = useNavigate();
  const wide = useWideLayout();
  const { choice: themeChoice } = useTheme();
  const [email, setEmail] = useState("");

  const [newUsername, setNewUsername] = useState("");
  const [usernameState, setUsernameState] = useState({ busy: false, error: "", success: "" });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordState, setPasswordState] = useState({ busy: false, error: "", success: "" });

  const [exportState, setExportState] = useState({ busy: false, error: "", success: "" });

  // null until loaded, so the switch doesn't flash the wrong position
  const [emailReplies, setEmailReplies] = useState<boolean | null>(null);
  const [emailState, setEmailState] = useState({ busy: false, error: "", success: "" });

  const [deletePassword, setDeletePassword] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [deleteState, setDeleteState] = useState({ busy: false, error: "", success: "" });

  useEffect(() => {
    api.get("/auth/me").then((res) => {
      setEmail(res.data.user.email);
      setNewUsername(res.data.user.username);
      setEmailReplies(res.data.user.emailReplies ?? true);
    }).catch(() => {});
  }, []);

  const saveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameState({ busy: true, error: "", success: "" });
    try {
      const res = await api.put("/account/username", { username: newUsername });
      setUsername(res.data.user.username);
      setUsernameState({ busy: false, error: "", success: "Username updated" });
    } catch (err) {
      setUsernameState({ busy: false, error: errorMessage(err, "We couldn't update your username."), success: "" });
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordState({ busy: true, error: "", success: "" });
    try {
      const res = await api.put("/account/password", { currentPassword, newPassword });
      // The change logs out every session; keep this device signed in with the fresh token
      localStorage.setItem("token", res.data.token);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordState({ busy: false, error: "", success: "Password changed. You've been logged out on your other devices." });
    } catch (err) {
      setPasswordState({ busy: false, error: errorMessage(err, "We couldn't change your password."), success: "" });
    }
  };

  const saveEmailReplies = async (value: boolean) => {
    setEmailReplies(value);
    setEmailState({ busy: true, error: "", success: "" });
    try {
      await api.put("/account/email-preferences", { emailReplies: value });
      setEmailState({ busy: false, error: "", success: value ? "Reply emails turned on" : "Reply emails turned off" });
    } catch (err) {
      setEmailReplies(!value);
      setEmailState({ busy: false, error: errorMessage(err, "We couldn't save that setting."), success: "" });
    }
  };

  const exportData = async (format: "csv" | "json") => {
    setExportState({ busy: true, error: "", success: "" });
    try {
      const { data } = (await api.get("/account/export")).data;
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        const rows = [
          ["Date", "Type", "Category", "Amount", "Note"],
          ...data.transactions.map((t: { date: string; type: string; category: string; amount: number; note: string | null }) => [
            t.date.slice(0, 10), t.type, t.category, t.amount, t.note,
          ]),
        ];
        download(`money-mitra-transactions-${stamp}.csv`, rows.map((r) => r.map(csvField).join(",")).join("\r\n"), "text/csv");
      } else {
        download(`money-mitra-data-${stamp}.json`, JSON.stringify(data, null, 2), "application/json");
      }
      setExportState({ busy: false, error: "", success: "Download started" });
    } catch (err) {
      setExportState({ busy: false, error: errorMessage(err, "We couldn't prepare your download."), success: "" });
    }
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteState({ busy: true, error: "", success: "" });
    try {
      await api.delete("/account", { data: { password: deletePassword } });
      localStorage.removeItem("token");
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteState({ busy: false, error: errorMessage(err, "We couldn't delete your account."), success: "" });
    }
  };

  return (
    <main className={`${pageWidth} py-8 space-y-6`}>
      <div className={wide ? "" : "max-w-2xl mx-auto"}>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">Manage your account and your data.</p>
      </div>

      {/* Wide screens: cards flow into two columns instead of one long strip */}
      <div className={wide ? "columns-2 gap-6 [&>section]:break-inside-avoid [&>section]:mb-6" : "max-w-2xl mx-auto space-y-6"}>

        <Card title="Profile" description="Your username is shown on questions and replies you don't post anonymously.">
          <form onSubmit={saveUsername} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-ink-700">Email</span>
              <input value={email} disabled className={`${inputClass} w-full mt-1.5 bg-canvas text-ink-500`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-700">Username</span>
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                pattern="[A-Za-z0-9_]{3,20}"
                title="3 to 20 characters: letters, numbers and underscores"
                className={`${inputClass} w-full mt-1.5`}
                required
              />
              <span className="mt-1 block text-xs text-ink-500">3 to 20 characters: letters, numbers and underscores.</span>
            </label>
            <Status {...usernameState} />
            <button type="submit" disabled={usernameState.busy || newUsername === username} className={button}>
              {usernameState.busy ? "Saving…" : "Save username"}
            </button>
          </form>
        </Card>

        <Card title="Password">
          <form onSubmit={savePassword} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-ink-700">Current password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`${inputClass} w-full mt-1.5`}
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-700">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                maxLength={72}
                className={`${inputClass} w-full mt-1.5`}
                required
              />
              <span className="mt-1 block text-xs text-ink-500">At least 8 characters, with a letter and a number.</span>
            </label>
            <Status {...passwordState} />
            <button type="submit" disabled={passwordState.busy} className={button}>
              {passwordState.busy ? "Changing…" : "Change password"}
            </button>
          </form>
        </Card>

        <Card title="Appearance" description="Choose light or dark, or follow your device's setting.">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 p-1 bg-ink-100 rounded-xl text-sm font-medium">
            {(["system", "light", "dark"] as ThemeChoice[]).map((option) => (
              <button
                key={option}
                role="radio"
                aria-checked={themeChoice === option}
                onClick={() => setTheme(option)}
                className={`py-2 rounded-lg capitalize transition ${
                  themeChoice === option ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
                }`}
              >
                {option === "system" ? "Device" : option}
              </button>
            ))}
          </div>
        </Card>

        <CategoriesCard />

        <Card title="Email notifications" description="Notifications always appear under the bell in the app. Choose whether you also get emails.">
          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <span>
              <span className="block text-sm font-medium text-ink-900">Replies to my questions</span>
              <span className="block text-sm text-ink-500">
                An email when someone answers a question you asked, at most once an hour per question.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={emailReplies ?? false}
              disabled={emailReplies === null || emailState.busy}
              onChange={(e) => saveEmailReplies(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative shrink-0 w-11 h-6 rounded-full bg-ink-200 transition peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
            />
          </label>
          <div className="mt-3">
            <Status {...emailState} />
          </div>
        </Card>

        <Card title="Your data" description="Download a copy of everything you've stored in Money Mitra.">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => exportData("csv")}
              disabled={exportState.busy}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-line font-medium text-ink-900 hover:bg-ink-100 transition disabled:opacity-60"
            >
              <Download size={16} /> Transactions (CSV)
            </button>
            <button
              onClick={() => exportData("json")}
              disabled={exportState.busy}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-line font-medium text-ink-900 hover:bg-ink-100 transition disabled:opacity-60"
            >
              <FileJson size={16} /> Everything (JSON)
            </button>
          </div>
          <p className="mt-3 text-xs text-ink-500">
            The CSV opens in Excel or Google Sheets. The JSON file includes your transactions, budgets, goals, questions and replies.
          </p>
          <div className="mt-3">
            <Status {...exportState} />
          </div>
        </Card>

        <Card
          title="Delete account"
          description="This permanently deletes your account, transactions, budgets and goals. Your questions and replies in Discuss stay visible as “Deleted user” so conversations still make sense."
          danger
        >
          <form onSubmit={deleteAccount} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-ink-700">Enter your password to confirm</span>
              <input
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className={`${inputClass} w-full mt-1.5`}
                required
              />
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-loss"
              />
              <span className="text-sm text-ink-700">I understand this can't be undone.</span>
            </label>
            <Status {...deleteState} />
            <button
              type="submit"
              disabled={!understood || deleteState.busy}
              className="flex items-center gap-2 bg-loss text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AlertTriangle size={16} /> {deleteState.busy ? "Deleting…" : "Delete my account"}
            </button>
          </form>
        </Card>
      </div>
    </main>
  );
}

export default Settings;
