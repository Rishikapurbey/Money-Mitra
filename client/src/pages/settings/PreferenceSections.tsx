import { useState } from "react";
import { Download, FileJson } from "lucide-react";
import api from "../../lib/api";
import { csvField } from "../../lib/csv";
import { setTheme, useTheme } from "../../lib/theme";
import type { ThemeChoice } from "../../lib/theme";
import CategoriesCard from "../../components/CategoriesCard";
import { Panel, SectionHeader, Status, Toggle } from "./shared";
import { errorMessage, idle, secondaryButton, useSettings } from "./context";

export function AppearanceSection() {
  const { choice } = useTheme();
  return (
    <>
      <SectionHeader title="Appearance" description="Choose light or dark, or follow your device's setting." />
      <Panel>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 p-1 bg-ink-100 rounded-xl text-sm font-medium max-w-md">
          {(["system", "light", "dark"] as ThemeChoice[]).map((option) => (
            <button
              key={option}
              role="radio"
              aria-checked={choice === option}
              onClick={() => setTheme(option)}
              className={`py-2 rounded-lg capitalize transition ${
                choice === option ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              {option === "system" ? "Device" : option}
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}

export function NotificationsSection() {
  const { me, updateMe } = useSettings();
  const [state, setState] = useState(idle);

  const save = async (value: boolean) => {
    updateMe({ emailReplies: value });
    setState({ busy: true, error: "", success: "" });
    try {
      await api.put("/account/email-preferences", { emailReplies: value });
      setState({ busy: false, error: "", success: value ? "Reply emails turned on" : "Reply emails turned off" });
    } catch (err) {
      updateMe({ emailReplies: !value });
      setState({ busy: false, error: errorMessage(err, "We couldn't save that setting."), success: "" });
    }
  };

  return (
    <>
      <SectionHeader
        title="Notifications"
        description="Notifications always appear under the bell in the app. Choose whether you also get emails."
      />
      <Panel title="Email">
        <Toggle
          label="Replies to my questions"
          description="An email when someone answers a question you asked, at most once an hour per question."
          checked={me?.emailReplies ?? false}
          disabled={!me || state.busy}
          onChange={save}
        />
        <div className="mt-3">
          <Status {...state} />
        </div>
      </Panel>
    </>
  );
}

export function PrivacySection() {
  const { me, updateMe } = useSettings();
  const [state, setState] = useState(idle);

  const save = async (key: "isPrivate" | "anonymousByDefault", value: boolean, message: string) => {
    updateMe({ [key]: value });
    setState({ busy: true, error: "", success: "" });
    try {
      await api.put("/account/privacy", { [key]: value });
      setState({ busy: false, error: "", success: message });
    } catch (err) {
      updateMe({ [key]: !value });
      setState({ busy: false, error: errorMessage(err, "We couldn't save that setting."), success: "" });
    }
  };

  return (
    <>
      <SectionHeader
        title="Privacy"
        description="Your transactions, budgets and goals are always private. Nobody else can ever see them."
      />
      <Panel title="Profile">
        <Toggle
          label="Private profile"
          description="People must ask to follow you, and only those you accept see your questions, replies and followers on your profile. What you post in Discuss stays visible there. Turning this off accepts any waiting requests."
          checked={me?.isPrivate ?? false}
          disabled={!me || state.busy}
          onChange={(value) => save("isPrivate", value, value ? "Your profile is now private" : "Your profile is now public")}
        />
      </Panel>
      <Panel title="Discuss">
        <Toggle
          label="Post anonymously by default"
          description="Ticks “anonymous” for you when you ask or reply. You can still untick it each time."
          checked={me?.anonymousByDefault ?? false}
          disabled={!me || state.busy}
          onChange={(value) =>
            save("anonymousByDefault", value, value ? "New posts will start as anonymous" : "New posts will start with your name")
          }
        />
      </Panel>
      <Status {...state} />
    </>
  );
}

export function CategoriesSection() {
  return (
    <>
      <SectionHeader
        title="Categories"
        description="Offered when you add a transaction. Renaming or merging also updates your past entries, budgets and recurring transactions."
      />
      <CategoriesCard />
    </>
  );
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DataSection() {
  const [state, setState] = useState(idle);

  const exportData = async (format: "csv" | "json") => {
    setState({ busy: true, error: "", success: "" });
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
      setState({ busy: false, error: "", success: "Download started" });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, "We couldn't prepare your download."), success: "" });
    }
  };

  return (
    <>
      <SectionHeader title="Download your data" description="A copy of everything you've stored in Money Mitra." />
      <Panel>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => exportData("csv")} disabled={state.busy} className={secondaryButton}>
            <Download size={16} /> Transactions (CSV)
          </button>
          <button onClick={() => exportData("json")} disabled={state.busy} className={secondaryButton}>
            <FileJson size={16} /> Everything (JSON)
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          The CSV opens in Excel or Google Sheets. The JSON file includes your transactions, categories, budgets, goals,
          recurring entries, questions and replies.
        </p>
        <div className="mt-3">
          <Status {...state} />
        </div>
      </Panel>
    </>
  );
}
