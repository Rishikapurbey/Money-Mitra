import { useEffect, useId, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { X } from "lucide-react";
import api from "../../lib/api";
import { nameOf } from "../../lib/me";
import { inputClass } from "../../lib/ui";
import type { AuthorProfile } from "../../lib/discuss";
import Avatar from "../Avatar";

export type PersonResult = AuthorProfile & {
  inGroup: "active" | "invited" | null;
};

// Matches the server: fewer letters would match almost everyone
const MIN_LETTERS = 3;
const DELAY_MS = 250;

const unavailable = (p: PersonResult) =>
  p.inGroup === "active"
    ? "Already in this group"
    : p.inGroup === "invited"
      ? "Invited"
      : null;

// The username field for inviting someone, suggesting people as they type. Picking one shows them as
// a card; the invite itself is still sent by the form's button, so a mis-tap never invites anyone.
function PersonPicker({
  id,
  groupId,
  value,
  onChange,
  selected,
  onSelect,
  onNotOnApp,
}: {
  id: string;
  groupId: string;
  value: string;
  onChange: (value: string) => void;
  selected: PersonResult | null;
  onSelect: (person: PersonResult | null) => void;
  onNotOnApp: () => void;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<PersonResult[]>([]);
  // The search the results belong to, so stale answers are never shown for newer typing
  const [resultsFor, setResultsFor] = useState("");
  const [problem, setProblem] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const query = value.trim().replace(/^@/, "");
  const searching = query.length >= MIN_LETTERS;

  useEffect(() => {
    if (!searching || selected) return;
    let live = true;
    const timer = setTimeout(() => {
      api
        .get(`/shared/groups/${groupId}/people`, { params: { q: query } })
        .then((res) => {
          if (!live) return;
          setResults(res.data.people);
          setResultsFor(query);
          setProblem("");
          setActive(-1);
        })
        .catch((err) => {
          if (!live) return;
          setResults([]);
          setResultsFor(query);
          setProblem(
            (isAxiosError(err) && err.response?.data?.error) ||
              "We couldn't search right now. You can still type the full username.",
          );
        });
    }, DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [groupId, query, searching, selected]);

  const ready = searching && resultsFor === query;
  const showList = open && searching && !selected;

  // On phones, bring the field up the screen when suggestions appear, so they aren't under the keyboard
  useEffect(() => {
    if (showList && window.matchMedia("(pointer: coarse)").matches)
      input.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [showList]);

  const pick = (person: PersonResult) => {
    if (unavailable(person)) return;
    onSelect(person);
    setOpen(false);
  };

  const move = (step: number) => {
    const choices = results
      .map((p, i) => (unavailable(p) ? -1 : i))
      .filter((i) => i >= 0);
    if (choices.length === 0) return;
    const at = choices.indexOf(active);
    setActive(
      choices[(at + step + choices.length) % choices.length] ?? choices[0],
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (
      e.key === "Enter" &&
      showList &&
      active >= 0 &&
      results[active]
    ) {
      // Picks the highlighted person instead of sending the form
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (selected) {
    return (
      <div className="mt-1 flex items-center gap-3 rounded-xl border border-brand-500 bg-surface px-3 py-2">
        <Avatar
          name={nameOf(selected)}
          avatarUrl={selected.avatarUrl}
          size="md"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink-900 truncate">
            {nameOf(selected)}
          </span>
          <span className="block text-xs font-normal text-ink-500 truncate">
            @{selected.username}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            onChange("");
            setTimeout(() => input.current?.focus());
          }}
          aria-label={`Remove ${nameOf(selected)}`}
          className="shrink-0 p-1.5 rounded-lg text-ink-400 hover:text-ink-900 hover:bg-ink-100 transition"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 font-normal">
          @
        </span>
        <input
          ref={input}
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          maxLength={40}
          required
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && active >= 0 ? `${listId}-${active}` : undefined
          }
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="username or name"
          className={`${inputClass} w-full font-normal !pl-8 scroll-mt-24`}
        />
      </div>
      {showList && (
        // Part of the card rather than floating over the page, so on phones it pushes the button down and
        // can be scrolled to instead of hiding behind the tab bar. Pressing inside it mustn't blur the field
        // first, or the list would close before the tap lands.
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="mt-1 bg-surface border border-line rounded-xl shadow-sm overflow-hidden"
        >
          {!ready ? (
            <p className="px-4 py-3 text-sm font-normal text-ink-500">
              Searching…
            </p>
          ) : problem ? (
            <p className="px-4 py-3 text-sm font-normal text-ink-500">
              {problem}
            </p>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm font-normal">
              <p className="text-ink-500">No one found with that name.</p>
              <button
                type="button"
                onClick={onNotOnApp}
                className="mt-1 font-medium text-brand-600 hover:underline"
              >
                Not on Money Mitra? Add them by name
              </button>
            </div>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label="People on Money Mitra"
              className="py-1"
            >
              {results.map((p, i) => {
                const note = unavailable(p);
                return (
                  <li
                    key={p.username}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    aria-disabled={note !== null}
                    onClick={() => pick(p)}
                    onMouseEnter={() => !note && setActive(i)}
                    className={`flex items-center gap-3 px-3 py-2 font-normal ${
                      note
                        ? "opacity-55 cursor-default"
                        : `cursor-pointer ${i === active ? "bg-ink-100" : ""}`
                    }`}
                  >
                    <Avatar
                      name={nameOf(p)}
                      avatarUrl={p.avatarUrl}
                      size="md"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink-900 truncate">
                        {nameOf(p)}
                      </span>
                      <span className="block text-xs text-ink-500 truncate">
                        {note ? `@${p.username} · ${note}` : `@${p.username}`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default PersonPicker;
