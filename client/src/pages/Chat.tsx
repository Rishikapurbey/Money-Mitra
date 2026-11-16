import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import api from "../lib/api";
import { announceChatsChange } from "../lib/dataEvents";
import { useToast } from "../lib/toast";
import { DELETED_TEXT, MAX_MESSAGE, dayLabel, mergeMessages, messageTime, personName, seenMessageId, startsNewDay } from "../lib/chat";
import type { ChatInfo, ChatMessage } from "../lib/chat";
import Avatar from "../components/Avatar";

// How often an open chat checks for new messages
const REFRESH_MS = 4_000;
// Counts as "at the bottom", so new messages scroll into view only when you weren't reading older ones
const NEAR_BOTTOM_PX = 120;

const errorText = (err: unknown, fallback: string) => (isAxiosError(err) && err.response?.data?.error) || fallback;

function Bubble({
  message,
  seen,
  options,
  onToggle,
  onUnsend,
}: {
  message: ChatMessage;
  seen: boolean;
  options: boolean;
  onToggle: () => void;
  onUnsend: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const mine = message.mine;
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <button
        type="button"
        onClick={mine && !message.deleted ? onToggle : undefined}
        disabled={!mine || message.deleted}
        aria-expanded={mine && !message.deleted ? options : undefined}
        className={`max-w-[85%] sm:max-w-[70%] text-left rounded-2xl px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap break-words disabled:cursor-default ${
          message.deleted
            ? "border border-line text-ink-400 italic"
            : mine
              ? "bg-brand-600 text-white rounded-br-md"
              : "bg-ink-100 text-ink-900 rounded-bl-md"
        }`}
      >
        {message.deleted ? DELETED_TEXT : message.body}
      </button>
      <span className="mt-0.5 px-1 text-[11px] text-ink-400">
        {messageTime(message.createdAt)}
        {seen && " · Seen"}
      </span>
      {options && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          {confirming ? (
            <>
              <span className="text-ink-500">Delete for everyone?</span>
              <button onClick={onUnsend} className="font-medium text-loss hover:underline">
                Delete
              </button>
              <button onClick={() => setConfirming(false)} className="text-ink-500 hover:underline">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} className="font-medium text-loss hover:underline">
              Delete for everyone
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// One chat: messages oldest first with the newest at the bottom, and the box to write in
function Chat() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [info, setInfo] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  // Where to scroll after the next render: the bottom, or back to where reading was before older messages loaded
  const pendingScroll = useRef<"bottom" | { height: number; top: number } | null>(null);
  const backTo = params.get("tab") === "requests" ? "/messages?tab=requests" : "/messages";

  const nearBottom = () => {
    const el = scroller.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  const refresh = useCallback(
    (first: boolean) => {
      if (!id || (!first && document.visibilityState !== "visible")) return;
      api
        .get(`/chats/${id}`)
        .then((res) => {
          const incoming: ChatMessage[] = res.data.messages;
          setInfo(res.data.conversation);
          setMessages((current) => {
            const merged = first ? incoming : mergeMessages(current, incoming);
            const grew = merged.length !== current.length || merged[merged.length - 1]?.id !== current[current.length - 1]?.id;
            if (first || (grew && nearBottom())) pendingScroll.current = "bottom";
            // Opening or receiving messages reads them, so the badge should drop
            if (first || (grew && !merged[merged.length - 1]?.mine)) announceChatsChange();
            return merged;
          });
          if (first) setHasMore(res.data.hasMore);
          setLoadedFor(id);
          setProblem("");
        })
        .catch((err) => {
          if (first) {
            setLoadedFor(id);
            setProblem(errorText(err, "We couldn't open this chat. Please check your connection."));
          }
        });
    },
    [id]
  );

  useEffect(() => {
    refresh(true);
    const timer = setInterval(() => refresh(false), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useLayoutEffect(() => {
    const el = scroller.current;
    const target = pendingScroll.current;
    if (!el || !target) return;
    if (target === "bottom") el.scrollTop = el.scrollHeight;
    else el.scrollTop = el.scrollHeight - target.height + target.top;
    pendingScroll.current = null;
  });

  const loadOlder = async () => {
    const oldest = messages[0];
    if (!id || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await api.get(`/chats/${id}`, { params: { before: oldest.createdAt } });
      const el = scroller.current;
      if (el) pendingScroll.current = { height: el.scrollHeight, top: el.scrollTop };
      setMessages((current) => mergeMessages(current, res.data.messages));
      setHasMore(res.data.hasMore);
    } catch (err) {
      toast({ message: errorText(err, "We couldn't load older messages.") });
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!id || !body || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/chats/${id}/messages`, { body });
      pendingScroll.current = "bottom";
      setMessages((current) => mergeMessages(current, [res.data.message]));
      setText("");
      // Replying to a request accepts it
      setInfo((current) => current && { ...current, myStatus: "accepted" });
      announceChatsChange();
      refresh(false);
    } catch (err) {
      toast({ message: errorText(err, "We couldn't send that. Please try again.") });
    } finally {
      setSending(false);
    }
  };

  const unsend = async (messageId: string) => {
    if (!id) return;
    try {
      const res = await api.delete(`/chats/${id}/messages/${messageId}`);
      setMessages((current) => mergeMessages(current, [res.data.message]));
      setOptionsFor(null);
      announceChatsChange();
    } catch (err) {
      toast({ message: errorText(err, "We couldn't delete that message.") });
    }
  };

  const accept = async () => {
    if (!id) return;
    try {
      await api.post(`/chats/${id}/accept`);
      setInfo((current) => current && { ...current, myStatus: "accepted" });
      announceChatsChange();
      navigate(`/messages/${id}`, { replace: true });
    } catch (err) {
      toast({ message: errorText(err, "We couldn't accept this request.") });
    }
  };

  const removeChat = async () => {
    if (!id) return;
    try {
      await api.delete(`/chats/${id}`);
      announceChatsChange();
      toast({ message: info?.myStatus === "request" ? "Request deleted" : "Chat deleted" });
      navigate(backTo, { replace: true });
    } catch (err) {
      toast({ message: errorText(err, "We couldn't delete this chat.") });
    }
  };

  const shell = "h-full bg-surface border-y md:border border-line md:rounded-2xl flex flex-col min-h-0 -mx-4 sm:-mx-6 md:mx-0";

  if (loadedFor !== id) {
    return (
      <section className={shell} aria-busy="true">
        <div className="h-16 border-b border-line" />
        <div className="flex-1 p-4 space-y-3">
          <div className="h-10 w-2/3 rounded-2xl bg-ink-100 animate-pulse" />
          <div className="h-10 w-1/2 ml-auto rounded-2xl bg-ink-100 animate-pulse" />
        </div>
      </section>
    );
  }

  if (problem || !info) {
    return (
      <section className={`${shell} items-center justify-center text-center p-8`}>
        <p className="font-medium text-ink-900">This chat isn't available</p>
        <p className="mt-1 text-sm text-ink-500">{problem}</p>
        <Link to={backTo} className="mt-4 text-sm font-medium text-brand-600 hover:underline">
          Back to messages
        </Link>
      </section>
    );
  }

  const name = personName(info.person);
  const seenId = seenMessageId(messages, info.seenUpTo);
  // A request with nothing showing (e.g. deleted, then reopened from their profile) needs no banner;
  // writing to them accepts it, like replying does
  const isRequest = info.myStatus === "request" && messages.some((m) => !m.mine);

  return (
    <section className={shell} aria-label={`Chat with ${name}`}>
      <header className="flex items-center gap-3 px-3 sm:px-4 h-16 border-b border-line shrink-0">
        <Link to={backTo} aria-label="Back to messages" className="md:hidden p-2 -ml-1 rounded-xl text-ink-500 hover:text-ink-900 hover:bg-ink-100">
          <ArrowLeft size={20} />
        </Link>
        {info.person ? (
          <Link to={`/u/${info.person.username}`} className="flex items-center gap-3 min-w-0 group">
            <Avatar name={name} avatarUrl={info.person.avatarUrl} />
            <span className="min-w-0">
              <span className="block font-medium text-ink-900 truncate group-hover:underline">{name}</span>
              <span className="block text-xs text-ink-500 truncate">@{info.person.username}</span>
            </span>
          </Link>
        ) : (
          <span className="flex items-center gap-3 min-w-0">
            <Avatar name="?" avatarUrl={null} />
            <span className="font-medium text-ink-500">Deleted user</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 text-sm shrink-0">
          {confirmDelete ? (
            <>
              <span className="hidden sm:inline text-ink-500">Delete for you?</span>
              <button onClick={removeChat} className="font-medium text-loss hover:underline">
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-ink-500 hover:underline">
                Cancel
              </button>
            </>
          ) : (
            !isRequest && (
              <button onClick={() => setConfirmDelete(true)} className="text-ink-500 hover:text-ink-900">
                Delete chat
              </button>
            )
          )}
        </div>
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-2" aria-live="polite">
        {hasMore && (
          <div className="text-center pb-2">
            <button onClick={loadOlder} disabled={loadingOlder} className="text-sm font-medium text-brand-600 hover:underline disabled:opacity-60">
              {loadingOlder ? "Loading…" : "Show older messages"}
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="text-center text-sm text-ink-500 py-8">
            {info.person ? `Say hello to ${name}. Messages here are only between the two of you.` : "No messages."}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={m.id}>
            {startsNewDay(messages, i) && (
              <p className="py-2 text-center text-xs font-medium text-ink-400">{dayLabel(m.createdAt)}</p>
            )}
            <Bubble
              message={m}
              seen={m.id === seenId}
              options={optionsFor === m.id}
              onToggle={() => setOptionsFor((current) => (current === m.id ? null : m.id))}
              onUnsend={() => unsend(m.id)}
            />
          </div>
        ))}
      </div>

      {isRequest && (
        <div className="shrink-0 border-t border-line px-4 py-3 bg-canvas">
          <p className="text-sm text-ink-700">
            <span className="font-medium text-ink-900">{name}</span> wants to message you. You don't follow each other or share a group.
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={accept} className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition">
              Accept
            </button>
            <button onClick={removeChat} className="px-4 py-2 rounded-xl border border-line text-sm font-medium text-ink-900 hover:bg-ink-100 transition">
              Delete
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-500">They won't know you've seen this unless you accept. Replying also accepts.</p>
        </div>
      )}
      {info.waitingForThem && info.canSend && messages.length === 0 && (
        <p className="shrink-0 border-t border-line px-4 py-2 text-xs text-ink-500 bg-canvas">
          You don't follow each other yet, so your first message will arrive as a request.
        </p>
      )}

      {info.canSend ? (
        <form onSubmit={send} className="shrink-0 border-t border-line p-2 sm:p-3 flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE))}
            onKeyDown={(e) => {
              // Enter sends on a keyboard; Shift+Enter starts a new line
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(hover: hover)").matches) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Write a message"
            aria-label="Message"
            className="flex-1 resize-none max-h-32 field-sizing-content border border-line bg-surface rounded-2xl px-4 py-2.5 text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            aria-label="Send"
            className="shrink-0 w-11 h-11 rounded-full bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 disabled:opacity-40 transition"
          >
            <SendHorizontal size={18} />
          </button>
        </form>
      ) : (
        <p className="shrink-0 border-t border-line px-4 py-3 text-sm text-ink-500 bg-canvas">{info.cannotSendReason}</p>
      )}
      {text.length > MAX_MESSAGE - 200 && info.canSend && (
        <p className="shrink-0 px-4 pb-2 text-right text-xs text-ink-500">
          {text.length.toLocaleString("en-IN")} / {MAX_MESSAGE.toLocaleString("en-IN")}
        </p>
      )}
    </section>
  );
}

// A fresh chat screen for each conversation, so nothing from the previous one carries over
export default function ChatPage() {
  const { id } = useParams();
  return <Chat key={id} />;
}
