import { useRef, useState } from "react";
import { isAxiosError } from "axios";

// The API host sleeps when idle, so the first request can take up to a minute.
// After this delay we tell the user it's waking up rather than looking frozen.
const SLOW_AFTER_MS = 4000;

export function useSubmit(fallbackError: string) {
  const [submitting, setSubmitting] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const run = async (action: () => Promise<void>) => {
    setError("");
    setSubmitting(true);
    timer.current = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    try {
      await action();
    } catch (err) {
      if (isAxiosError(err) && !err.response) {
        setError("We can't reach the server right now. Please try again in a moment.");
      } else if (isAxiosError(err)) {
        setError(err.response?.data?.error || fallbackError);
      } else {
        setError(fallbackError);
      }
    } finally {
      clearTimeout(timer.current);
      setSubmitting(false);
      setSlow(false);
    }
  };

  return { submitting, slow, error, run };
}
