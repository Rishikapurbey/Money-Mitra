import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useWideLayout } from "../../lib/useMediaQuery";

export function Status({ error, success }: { error: string; success: string }) {
  if (error) return <p role="alert" className="text-sm text-loss bg-loss-soft px-3 py-2 rounded-lg">{error}</p>;
  if (success) {
    return (
      <p className="flex items-center gap-2 text-sm text-gain font-medium">
        <CheckCircle2 size={16} /> {success}
      </p>
    );
  }
  return null;
}

// Title and description at the top of a section; on phones, a way back to the list
export function SectionHeader({ title, description }: { title: string; description?: string }) {
  const wide = useWideLayout();
  return (
    <div>
      {!wide && (
        <Link to="/settings" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition mb-4">
          <ArrowLeft size={16} /> Settings
        </Link>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
      {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
    </div>
  );
}

// A group of related settings inside a section
export function Panel({ title, description, children, danger }: { title?: string; description?: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className={`bg-surface border rounded-2xl p-6 ${danger ? "border-loss/40" : "border-line"}`}>
      {title && <h2 className={`font-semibold ${danger ? "text-loss" : "text-ink-900"}`}>{title}</h2>}
      {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      <div className={title || description ? "mt-5" : ""}>{children}</div>
    </section>
  );
}

// An on/off setting with a label and explanation
export function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <span>
        <span className="block text-sm font-medium text-ink-900">{label}</span>
        <span className="block text-sm text-ink-500">{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative shrink-0 w-11 h-6 rounded-full bg-ink-200 transition peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 peer-disabled:opacity-60 after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
    </label>
  );
}
