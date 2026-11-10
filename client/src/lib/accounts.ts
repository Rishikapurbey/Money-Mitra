import { useEffect, useState } from "react";
import api from "./api";
import { onDataChange } from "./dataEvents";

// A bank account, cash or credit card that Tracker entries are paid from or received in
export interface Account {
  id: string;
  name: string;
  kind: "asset" | "liability";
  type: string;
  // The balance now; for a credit card, what's owed on it
  value: number;
  isDefault: boolean;
}

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
