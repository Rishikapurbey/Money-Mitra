import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { MoreHorizontal, MoreVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface MenuAction {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void | Promise<void>;
  // Shown in red, for things like Block and Delete
  danger?: boolean;
  // Asks once more inside the menu before doing it
  confirm?: { title: string; body?: string; action: string };
}

// A "more" button that opens a small menu of less common actions (block, delete, report), so they
// don't crowd the screen. Actions that can't easily be undone ask once more inside the menu.
function ActionMenu({
  actions,
  label = "More options",
  vertical = false,
  className = "",
  trigger,
}: {
  actions: MenuAction[];
  label?: string;
  // ⋮ instead of ⋯, e.g. at the top of a chat
  vertical?: boolean;
  className?: string;
  // A custom button look; the default is a quiet icon button
  trigger?: (props: { open: boolean }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<MenuAction | null>(null);
  const [busy, setBusy] = useState(false);
  // Where the menu sits: just under the button, lined up with its right edge
  const [place, setPlace] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = () => {
    setOpen(false);
    setConfirming(null);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !menu.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // The menu is placed on the page itself, so it closes rather than drifting away when things move
    const onMove = () => close();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) return close();
    const rect = button.current?.getBoundingClientRect();
    if (rect) setPlace({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    setOpen(true);
  };

  const run = async (action: MenuAction) => {
    setBusy(true);
    try {
      await action.onSelect();
    } finally {
      setBusy(false);
      close();
    }
  };

  const Icon = vertical ? MoreVertical : MoreHorizontal;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={trigger ? "" : `p-2 rounded-xl transition ${open ? "bg-ink-100 text-ink-900" : "text-ink-500 hover:text-ink-900 hover:bg-ink-100"}`}
      >
        {trigger ? trigger({ open }) : <Icon size={20} />}
      </button>
      {open &&
        place &&
        // Drawn on the page itself, so a card that hides its overflow (like a profile header) can't cut it off
        createPortal(
        <div
          ref={menu}
          id={menuId}
          role="menu"
          style={{ top: place.top, right: place.right }}
          className="fixed z-50 w-64 max-w-[calc(100vw-1rem)] bg-surface border border-line rounded-xl shadow-lg py-1"
        >
          {confirming?.confirm ? (
            <div className="px-4 py-3 space-y-3">
              <div>
                <p className="text-sm font-medium text-ink-900">{confirming.confirm.title}</p>
                {confirming.confirm.body && <p className="mt-1 text-xs text-ink-500 leading-relaxed">{confirming.confirm.body}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(confirming)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition ${confirming.danger ? "bg-loss hover:opacity-90" : "bg-brand-600 hover:bg-brand-700"}`}
                >
                  {confirming.confirm.action}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="flex-1 px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink-900 hover:bg-ink-100 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            actions.map((action) => (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => (action.confirm ? setConfirming(action) : run(action))}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-ink-100 disabled:opacity-60 transition ${action.danger ? "text-loss" : "text-ink-700"}`}
              >
                {action.icon && <action.icon size={16} className="shrink-0" />}
                {action.label}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default ActionMenu;
