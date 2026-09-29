import { useCallback, useEffect, useState } from "react";
import api from "./api";
import { onDataChange } from "./dataEvents";

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  transactions: number;
  recurring: number;
  hasBudget: boolean;
}

const fetchCategories = (): Promise<Category[] | null> =>
  api.get("/categories").then(
    (res) => res.data.categories,
    () => null
  );

// The user's categories, loaded again whenever `refreshKey` changes or data changes elsewhere in the app
export function useCategories(refreshKey?: unknown) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    const load = () =>
      fetchCategories().then((list) => {
        if (!current) return;
        if (list) setCategories(list);
        setFailed(!list);
        setLoaded(true);
      });
    load();
    const stop = onDataChange(load);
    return () => {
      current = false;
      stop();
    };
  }, [refreshKey, retry]);

  const reload = useCallback(() => setRetry((n) => n + 1), []);
  return { categories, loaded, failed, reload };
}

// One-tap choices for a form: the ones used most recently first, then the rest of the user's list
export function quickPicks(recent: string[], categories: { name: string; type: string }[], type: string, limit = 6) {
  const picks: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key) || picks.length >= limit) return;
    seen.add(key);
    picks.push(name);
  };
  recent.forEach(add);
  categories.filter((c) => c.type === type).forEach((c) => add(c.name));
  return picks;
}

// "12 transactions · 1 recurring · budget", or null when nothing uses the category
export function usageSummary(c: Pick<Category, "transactions" | "recurring" | "hasBudget">) {
  const parts = [
    c.transactions > 0 && `${c.transactions} transaction${c.transactions === 1 ? "" : "s"}`,
    c.recurring > 0 && `${c.recurring} recurring`,
    c.hasBudget && "budget",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
