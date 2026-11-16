import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useParams, useSearchParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import api from "../lib/api";
import { useTitle } from "../lib/useTitle";
import { pageWidth } from "../lib/ui";
import { onChatsChange } from "../lib/dataEvents";
import { DELETED_TEXT, inboxTime, personName } from "../lib/chat";
import type { ChatSummary } from "../lib/chat";
import Avatar from "../components/Avatar";

// How often the inbox checks for new messages while it's open
const REFRESH_MS = 10_000;

// The chat screen's height: the window minus the top bar (and its 1px border), and on phones the tab bar's space too,
// so the messages scroll inside it and the box to type in stays in view
export const chatHeight = "h-[calc(100dvh-9rem-1px)] md:h-[calc(100dvh-7rem-1px)]";

function Row({ chat, tab }: { chat: ChatSummary; tab: string }) {
  const name = personName(chat.person);
  const { lastMessage } = chat;
  return (
    <li>
      <NavLink
        to={`/messages/${chat.id}${tab === "requests" ? "?tab=requests" : ""}`}
        className={({ isActive }) => `flex items-center gap-3 px-4 py-3 transition ${isActive ? "bg-ink-100" : "hover:bg-canvas"}`}
      >
        <Avatar name={name} avatarUrl={chat.person?.avatarUrl ?? null} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`truncate ${chat.unread ? "font-semibold text-ink-900" : "font-medium text-ink-900"}`}>{name}</span>
            <span className={`shrink-0 text-xs ${chat.unread ? "text-brand-600 font-semibold" : "text-ink-500"}`}>
              {inboxTime(lastMessage.createdAt)}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span
              className={`truncate text-sm ${lastMessage.deleted ? "italic text-ink-400" : chat.unread ? "text-ink-900" : "text-ink-500"}`}
            >
              {lastMessage.mine && !lastMessage.deleted && "You: "}
              {lastMessage.deleted ? DELETED_TEXT : lastMessage.text}
            </span>
            {chat.unread && <span className="ml-auto shrink-0 w-2.5 h-2.5 rounded-full bg-brand-600" aria-label="Unread" />}
          </span>
        </span>
      </NavLink>
    </li>
  );
}

function Inbox() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "requests" ? "requests" : "chats";
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const [loadedTab, setLoadedTab] = useState("");
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    Promise.all([api.get("/chats", { params: { tab } }), api.get("/chats/unread")])
      .then(([list, counts]) => {
        setChats(list.data.conversations);
        setRequestCount(counts.data.requests);
        setLoadedTab(tab);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [tab]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    const stop = onChatsChange(load);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(timer);
      stop();
      document.removeEventListener("visibilitychange", load);
    };
  }, [load]);

  const tabButton = (key: "chats" | "requests", label: string) => (
    <button
      onClick={() => setParams(key === "requests" ? { tab: "requests" } : {}, { replace: true })}
      aria-pressed={tab === key}
      className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${tab === key ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900"}`}
    >
      {label}
      {key === "requests" && requestCount > 0 && (
        <span className="ml-1.5 inline-block min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-xs leading-5 tabular-nums">
          {requestCount}
        </span>
      )}
    </button>
  );

  const ready = chats !== null && loadedTab === tab;

  return (
    <section aria-label="Inbox" className="bg-surface border border-line rounded-2xl overflow-hidden flex flex-col min-h-0 h-full">
      <div className="p-4 border-b border-line space-y-3">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">Messages</h1>
        <div className="flex gap-1 p-1 rounded-xl bg-ink-100">
          {tabButton("chats", "Chats")}
          {tabButton("requests", "Requests")}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {failed && !ready ? (
          <p className="p-6 text-sm text-ink-500">We couldn't load your messages. Please check your connection.</p>
        ) : !ready ? (
          <div className="p-4 space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-ink-100 animate-pulse" />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="p-6 text-center">
            <p className="font-medium text-ink-900">{tab === "requests" ? "No message requests" : "No messages yet"}</p>
            <p className="mt-1 text-sm text-ink-500">
              {tab === "requests"
                ? "Messages from people you don't follow or share a group with wait here until you accept them."
                : "Find someone and tap Message on their profile."}
            </p>
            {tab === "chats" && (
              <Link to="/search" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
                Search people
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {chats.map((c) => (
              <Row key={c.id} chat={c} tab={tab} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// /messages and /messages/:id. Wide screens show the inbox beside the open chat; phones show one at a time.
export default function Messages() {
  const { id } = useParams();
  useTitle("Messages");
  return (
    <main className={`${pageWidth} md:py-6`}>
      <div className={`${chatHeight} md:grid md:grid-cols-[22rem_minmax(0,1fr)] md:gap-6`}>
        <div className={`${id ? "hidden md:block" : "block"} h-full min-h-0 pt-4 pb-2 md:p-0`}>
          <Inbox />
        </div>
        <div className={`${id ? "block" : "hidden md:block"} h-full min-h-0`}>
          {id ? (
            <Outlet />
          ) : (
            <section className="h-full bg-surface border border-line rounded-2xl flex flex-col items-center justify-center text-center p-8">
              <MessageCircle size={32} className="text-ink-300" />
              <p className="mt-3 font-medium text-ink-900">Your messages</p>
              <p className="mt-1 text-sm text-ink-500 max-w-xs">Choose a chat on the left, or find someone with search and tap Message on their profile.</p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
