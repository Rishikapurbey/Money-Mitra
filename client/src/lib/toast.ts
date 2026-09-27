import { createContext, useContext } from "react";

export interface ToastOptions {
  message: string;
  // An optional button, e.g. "Undo"
  action?: { label: string; onClick: () => void };
}

export const ToastContext = createContext<(toast: ToastOptions) => void>(() => {});

// Shows a short message at the bottom of the screen
export const useToast = () => useContext(ToastContext);
