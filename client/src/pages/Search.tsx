import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { Search as SearchIcon, X } from "lucide-react";
import api from "../lib/api";
import { inputClass, pageWidth } from "../lib/ui";
import { useTitle } from "../lib/useTitle";
import PersonRow from "../components/PersonRow";

interface Found {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  following: "accepted" | "pending" | null;
  followsYou: boolean;
}

// Matches the server
const MIN_LETTERS = 2;
const DELAY_MS = 250;

// How the viewer is connected to someone, shown on the right of their row
function connection(p: Found) {
  if (p.following === "accepted" && p.followsYou)
    return "You follow each other";
  if (p.following === "accepted") return "Following";
  if (p.following === "pending") return "Requested";
  if (p.followsYou) return "Follows you";
  return null;
}

// Find people by name or @username. The search is kept in the address, so going back to it from a
// profile shows the same results.
export default function Search() {
  useTitle("Search");
  const [params, setParams] = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<Found[]>([]);
  // The search the results belong to, so stale answers are never shown for newer typing
  const [resultsFor, setResultsFor] = useState("");
  const [problem, setProblem] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const query = value.trim().replace(/^@/, "");
  const searching = query.length >= MIN_LETTERS;

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    if (!searching) return;
    let live = true;
    const timer = setTimeout(() => {
      setParams(value.trim() ? { q: value.trim() } : {}, { replace: true });
      api
        .get("/search/people", { params: { q: query } })
        .then((res) => {
          if (!live) return;
          setResults(res.data.people);
          setResultsFor(query);
          setProblem("");
        })
        .catch((err) => {
          if (!live) return;
          setResults([]);
          setResultsFor(query);
          setProblem(
            (isAxiosError(err) && err.response?.data?.error) ||
              "We couldn't search right now. Please try again.",
          );
        });
    }, DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, searching, value, setParams]);

  const clear = () => {
    setValue("");
    setParams({}, { replace: true });
    input.current?.focus();
  };

  const ready = searching && resultsFor === query;

  return (
    <main className={`${pageWidth} py-8 space-y-5`}>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
        Search
      </h1>
      <div className="relative max-w-2xl">
        <SearchIcon
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
        />
        <input
          ref={input}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search people by name or @username"
          aria-label="Search people"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          className={`${inputClass} w-full pl-11 pr-11 [&::-webkit-search-cancel-button]:hidden`}
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-ink-400 hover:text-ink-900 transition"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {!searching ? (
        <p className="text-sm text-ink-500">
          {query.length === 1
            ? "Keep typing: at least 2 letters."
            : "Find friends to follow, message or invite to a shared group."}
        </p>
      ) : !ready ? (
        <p className="text-sm text-ink-500" aria-live="polite">
          Searching…
        </p>
      ) : problem ? (
        <p className="text-sm text-loss">{problem}</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-ink-500" aria-live="polite">
          No one matches “{query}”. Check the spelling, or try their @username.
        </p>
      ) : (
        // One list on phones; cards side by side on wider screens, so the page uses its width
        <section aria-label="People">
          <ul className="bg-surface border border-line rounded-2xl divide-y divide-line overflow-hidden sm:bg-transparent sm:border-0 sm:rounded-none sm:divide-y-0 sm:overflow-visible sm:grid sm:grid-cols-2 xl:grid-cols-3 sm:gap-3">
            {results.map((p) => {
              const label = connection(p);
              return (
                <PersonRow
                  key={p.username}
                  person={p}
                  className="sm:bg-surface sm:border sm:border-line sm:rounded-2xl"
                >
                  {label && (
                    <span className="text-xs font-medium text-ink-500">
                      {label}
                    </span>
                  )}
                </PersonRow>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
