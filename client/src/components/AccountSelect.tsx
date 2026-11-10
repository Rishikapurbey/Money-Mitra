import { Link } from "react-router-dom";
import { inputClass } from "../lib/ui";
import { accountName } from "../lib/accounts";
import type { Account } from "../lib/accounts";

// "Paid from" or "Received in": which account an entry moves. "" means no account.
// With no accounts yet, a short pointer to Net worth takes its place.
function AccountSelect({
  accounts,
  value,
  onChange,
  type,
  className = "",
  compact = false,
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  type: string;
  className?: string;
  compact?: boolean;
}) {
  if (accounts.length === 0) {
    return (
      <p className={`text-xs text-ink-500 ${className}`}>
        Add your bank account or cash in{" "}
        <Link to="/tracker/net-worth" className="font-medium text-brand-700 hover:underline">
          Net worth
        </Link>{" "}
        to see its balance move with what you add here.
      </p>
    );
  }
  // An entry can point at an account that has since been removed; it stays chosen until changed
  const known = value === "" || accounts.some((a) => a.id === value);
  return (
    <label className={`block text-sm font-medium text-ink-700 ${className}`}>
      {type === "income" ? "Received in" : "Paid from"}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} w-full mt-1 font-normal ${compact ? "py-2" : ""}`}
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {accountName(a)}
            {a.isDefault ? " (default)" : ""}
          </option>
        ))}
        {!known && <option value={value}>A removed account</option>}
        <option value="">No account</option>
      </select>
    </label>
  );
}

export default AccountSelect;
