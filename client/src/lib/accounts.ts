import { useEffect, useState } from "react";
import api from "./api";
import { onDataChange } from "./dataEvents";
import { formatINR } from "./ui";

// A bank account, cash or credit card that Tracker entries are paid from or received in
export interface Account {
  id: string;
  name: string;
  kind: "asset" | "liability";
  type: string;
  // The balance now; for a credit card, what's owed on it
  value: number;
  isDefault: boolean;
  // For a credit card: how much can be owed on it, if given
  creditLimit: number | null;
}

// Money moved between two of the user's own accounts
export interface Transfer {
  id: string;
  amount: number;
  date: string;
  note: string | null;
  fromId: string;
  toId: string;
}

// Returned after saving an entry or transfer that leaves an account below zero, or a card near or over its limit
export interface AccountAlert {
  kind: "overdrawn" | "near_limit" | "over_limit";
  accountId: string;
  name: string;
  value: number;
  limit?: number;
}

export function accountAlertText(alert: AccountAlert) {
  if (alert.kind === "overdrawn") return `${alert.name} is now ${formatINR(alert.value)}, more than it held`;
  const limit = alert.limit ?? 0;
  if (alert.kind === "over_limit") return `${alert.name} is ${formatINR(alert.value - limit)} over its ${formatINR(limit)} limit`;
  return `${alert.name} has used ${Math.round((alert.value / limit) * 100)}% of its ${formatINR(limit)} limit`;
}

// The toast after saving, with an account alert added when there is one
export const withAccountAlert = (saved: string, alert: AccountAlert | null | undefined) =>
  alert ? `${saved.replace(/\.$/, "")}. ${accountAlertText(alert)}.` : saved;

// Kept in step with the server's ACCOUNT_TYPES in networth.ts
export const ACCOUNT_TYPES: Record<Account["kind"], string[]> = { asset: ["bank", "cash"], liability: ["credit_card"] };
export const isAccount = (kind: string, type: string) => ACCOUNT_TYPES[kind as Account["kind"]]?.includes(type) ?? false;

export const accountName = (a: Pick<Account, "name" | "type">) => (a.type === "credit_card" ? `${a.name} (card)` : a.name);

// The user's accounts, reloaded whenever data changes elsewhere (e.g. an account was added)
export function useAccounts(refreshKey?: unknown) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let current = true;
    const load = () =>
      api
        .get("/networth/accounts")
        .then((res) => {
          if (!current) return;
          setAccounts(res.data.accounts);
          setLoaded(true);
        })
        .catch(() => current && setLoaded(true));
    load();
    const stop = onDataChange(load);
    return () => {
      current = false;
      stop();
    };
  }, [refreshKey]);

  const defaultId = accounts.find((a) => a.isDefault)?.id ?? "";
  return { accounts, loaded, defaultId };
}
