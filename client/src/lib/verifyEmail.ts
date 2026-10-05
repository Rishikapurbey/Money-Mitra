import { useState } from "react";
import { isAxiosError } from "axios";
import api from "./api";
import { useToast } from "./toast";

// Sends a new confirmation link and says how it went in a toast
export function useResendVerification() {
  const [sending, setSending] = useState(false);
  const toast = useToast();

  const resend = async () => {
    setSending(true);
    try {
      const res = await api.post("/auth/resend-verification");
      toast({ message: res.data.message });
    } catch (err) {
      toast({ message: (isAxiosError(err) && err.response?.data?.error) || "We couldn't send the link. Please try again." });
    } finally {
      setSending(false);
    }
  };

  return { sending, resend };
}
