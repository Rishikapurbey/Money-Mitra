import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PieChart, Zap, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";

const features = [
  { icon: Zap, text: "Log income and expenses in seconds" },
  { icon: PieChart, text: "See exactly where your money goes" },
  { icon: ShieldCheck, text: "Your data stays private to you" },
];

export const authInputClass =
  "w-full border border-line bg-surface rounded-xl px-4 py-3 text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-canvas">
      <aside className="dark-panel bg-ink-900 text-white px-6 py-8 sm:px-10 lg:p-14 flex flex-col justify-between">
        <Link to="/" className="w-fit" aria-label="Money Mitra home">
          <Logo tone="dark" />
        </Link>

        <div className="hidden lg:block max-w-md">
          <h2 className="text-4xl font-semibold tracking-tight leading-tight">
            Track every rupee with clarity.
          </h2>
          <p className="mt-4 text-ink-300 leading-relaxed">
            A calm, simple place to understand your spending and build better money habits.
          </p>
          <ul className="mt-10 space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-ink-200">
                <span className="bg-ink-800 p-2 rounded-lg">
                  <Icon size={16} className="text-brand-300" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="hidden lg:block text-sm text-ink-500">© {new Date().getFullYear()} Money Mitra</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
          <p className="mt-1.5 text-ink-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
