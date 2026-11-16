import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { MessageCircle } from "lucide-react";
import api from "../lib/api";
import { useToast } from "../lib/toast";

// On someone's profile: opens your chat with them (creating it if needed, without sending anything)
function MessageButton({ username }: { username: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    try {
      const res = await api.post("/chats", { username });
      navigate(`/messages/${res.data.id}`);
    } catch (err) {
      toast({ message: (isAxiosError(err) && err.response?.data?.error) || "We couldn't open the chat. Please try again." });
      setOpening(false);
    }
  };

  return (
    <button
      onClick={open}
      disabled={opening}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line text-sm font-medium text-ink-900 hover:bg-ink-100 disabled:opacity-60 transition"
    >
      <MessageCircle size={15} /> Message
    </button>
  );
}

export default MessageButton;
