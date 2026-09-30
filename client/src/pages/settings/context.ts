import { useOutletContext } from "react-router-dom";
import { isAxiosError } from "axios";

export interface Me {
  email: string;
  username: string;
  emailReplies: boolean;
  createdAt: string;
}

export interface SettingsContext {
  // null until loaded
  me: Me | null;
  updateMe: (changes: Partial<Me>) => void;
}

export const useSettings = () => useOutletContext<SettingsContext>();

export const errorMessage = (err: unknown, fallback: string) =>
  (isAxiosError(err) && err.response?.data?.error) || fallback;

export type FormState = { busy: boolean; error: string; success: string };
export const idle: FormState = { busy: false, error: "", success: "" };

export const primaryButton =
  "bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed";
export const secondaryButton =
  "flex items-center gap-2 px-5 py-2.5 rounded-xl border border-line font-medium text-ink-900 hover:bg-ink-100 transition disabled:opacity-60";
