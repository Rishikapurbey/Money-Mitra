import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import api from "../lib/api";
import { onChatsChange } from "../lib/dataEvents";

// How often the badge checks for new messages while the app is open
const REFRESH_MS = 20_000;

// The top-bar link to the inbox, with the number of chats that have unread messages plus new requests
function MessagesButton() {
  const [count, setCount] = useState(0);
  const { pathname } = useLocation();

  useEffect(() => {
    let current = true;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      api
        .get("/chats/unread")
        .then((res) => current && setCount(res.data.chats + res.data.requests))
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const stop = onChatsChange(refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      current = false;
      clearInterval(timer);
      stop();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname]);

  return (
    <NavLink
      to="/messages"
      aria-label={count > 0 ? `Messages, ${count} unread` : "Messages"}
      className={({ isActive }) =>
        `relative p-2 rounded-xl transition ${isActive ? "text-ink-900 bg-ink-100" : "text-ink-500 hover:text-ink-900 hover:bg-ink-100"}`
      }
    >
      <MessageCircle size={20} />
      {count > 0 && (
        <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-loss text-white text-[11px] font-semibold leading-[18px] text-center tabular-nums">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </NavLink>
  );
}

export default MessagesButton;
