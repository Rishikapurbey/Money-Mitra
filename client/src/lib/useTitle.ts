import { useEffect } from "react";

const DEFAULT_TITLE = "Money Mitra: track, learn and ask about money";

// Sets the browser tab title, e.g. "Dashboard · Money Mitra"
export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Money Mitra` : DEFAULT_TITLE;
  }, [title]);
}
