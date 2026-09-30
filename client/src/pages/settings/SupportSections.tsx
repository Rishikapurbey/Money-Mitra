import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import api from "../../lib/api";
import { inputClass } from "../../lib/ui";
import { appFaqs, faqs } from "../../lib/faqs";
import { Logo } from "../../components/Logo";
import { Panel, SectionHeader, Status } from "./shared";
import { errorMessage, idle, primaryButton } from "./context";

export function HelpSection() {
  return (
    <>
      <SectionHeader title="Help & FAQ" description="Answers to common questions. Can't find yours? Send us feedback." />
      <Panel>
        <div className="divide-y divide-line -my-2">
          {[...appFaqs, ...faqs].map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink-900">
                {f.q}
                <span className="text-ink-400 text-xl leading-none transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 text-sm text-ink-700 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </Panel>
      <p className="text-sm text-ink-500">
        Still stuck?{" "}
        <Link to="/settings/feedback" className="font-medium text-brand-700 underline underline-offset-2 hover:no-underline">
          Send us a message
        </Link>
        .
      </p>
    </>
  );
}

const KINDS = [
  { value: "idea", label: "An idea" },
  { value: "problem", label: "Something isn't working" },
  { value: "question", label: "A question" },
  { value: "other", label: "Something else" },
];

export function FeedbackSection() {
  const [kind, setKind] = useState("idea");
  const [message, setMessage] = useState("");
  const [state, setState] = useState(idle);
  const [sent, setSent] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: "", success: "" });
    try {
      await api.post("/feedback", { kind, message });
      setMessage("");
      setSent(true);
      setState(idle);
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, "We couldn't send your message. Please try again."), success: "" });
    }
  };

  return (
    <>
      <SectionHeader title="Send feedback" description="Ideas, problems or questions go straight to the people building Money Mitra." />
      <Panel>
        {sent ? (
          <div className="text-center py-6">
            <CheckCircle2 size={28} className="mx-auto text-gain" />
            <p className="mt-3 font-medium text-ink-900">Thank you, we've got your message</p>
            <p className="mt-1 text-sm text-ink-500">If it needs a reply, we'll write to the email on your account.</p>
            <button onClick={() => setSent(false)} className="mt-4 text-sm font-medium text-brand-700 hover:underline">
              Send another
            </button>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4">
            <fieldset>
              <legend className="text-sm font-medium text-ink-700">What's it about?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <label
                    key={k.value}
                    className={`px-3 py-1.5 rounded-full text-sm border cursor-pointer transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
                      kind === k.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink-700 hover:border-ink-300"
                    }`}
                  >
                    <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="sr-only" />
                    {k.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-sm font-medium text-ink-700">Your message</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                minLength={10}
                maxLength={2000}
                placeholder={kind === "problem" ? "What happened, and what did you expect to happen?" : "Tell us what's on your mind"}
                className={`${inputClass} w-full mt-1.5 resize-y`}
                required
              />
              <span className="mt-1 block text-xs text-ink-500 text-right">{message.length}/2000</span>
            </label>
            <p className="text-xs text-ink-500">Please don't include passwords or bank details. Your username and email are sent with your message so we can reply.</p>
            <Status {...state} />
            <button type="submit" disabled={state.busy || message.trim().length < 10} className={primaryButton}>
              {state.busy ? "Sending…" : "Send feedback"}
            </button>
          </form>
        )}
      </Panel>
    </>
  );
}

const buildDate = new Date(__BUILD_TIME__).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export function AboutSection() {
  return (
    <>
      <SectionHeader title="About" />
      <Panel>
        <Logo />
        <p className="mt-4 text-sm text-ink-700 leading-relaxed">
          Money Mitra is a free place to track your money, learn what financial terms mean in plain English, and ask
          questions without judgement.
        </p>
        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink-500">Version</dt>
          <dd className="text-ink-900 font-medium tabular-nums">{__BUILD_ID__}</dd>
          <dt className="text-ink-500">Updated</dt>
          <dd className="text-ink-900">{buildDate}</dd>
        </dl>
      </Panel>
      <Panel title="Your privacy">
        <ul className="space-y-2 text-sm text-ink-700 leading-relaxed list-disc pl-5">
          <li>Your transactions, budgets, goals and categories are private. Nobody else can see them.</li>
          <li>Other people only see your profile and the questions and replies you post under your name.</li>
          <li>We never ask for bank logins or card details, we don't show ads and we don't sell your data.</li>
          <li>You can download everything or delete your account at any time from Settings.</li>
        </ul>
      </Panel>
      <p className="text-xs text-ink-400">
        Money Mitra is for education and personal tracking, not financial advice. For decisions about your own
        situation, consider a qualified adviser.
      </p>
    </>
  );
}
