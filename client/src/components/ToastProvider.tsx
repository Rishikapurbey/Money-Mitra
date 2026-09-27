import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { ToastContext } from "../lib/toast";
import type { ToastOptions } from "../lib/toast";

// Shows one toast at a time; a new one replaces the current one
function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((options: ToastOptions) => {
    setToast({ ...options, id: Date.now() });
  }, []);

  // Messages with an action stay a little longer, so there's time to press Undo
  useEffect(() => {
    if (!toast) return;
    timer.current = setTimeout(() => setToast(null), toast.action ? 6000 : 3500);
    return () => clearTimeout(timer.current);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="fixed inset-x-0 bottom-24 md:bottom-6 z-40 flex justify-center px-4 pointer-events-none">
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="dark-panel pointer-events-auto flex items-center gap-4 bg-ink-900 text-white text-sm rounded-xl shadow-lg pl-4 pr-2 py-2.5 max-w-md"
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
                className="font-semibold text-brand-300 hover:text-white px-2 py-1 rounded-lg transition"
              >
                {toast.action.label}
              </button>
            )}
            <button onClick={() => setToast(null)} aria-label="Dismiss" className="p-1 text-ink-300 hover:text-white transition">
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
