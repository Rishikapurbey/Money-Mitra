import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, CalendarCheck, CalendarRange, CheckCircle2, CircleAlert, Landmark, Receipt, EyeOff, MessageCircle, PiggyBank, ThumbsUp, UserCheck, UserPlus } from "lucide-react";
import api from "../lib/api";
import { timeAgo } from "../lib/discuss";
import { announceNotificationsChange, onNotificationsChange } from "../lib/dataEvents";
import { notificationLink } from "../lib/notifications";
import type { AppNotification } from "../lib/notifications";
import { nameOf } from "../lib/me";
import Avatar from "./Avatar";

const REFRESH_MS = 60_000;

const ICONS = {
  reply_to_question: MessageCircle,
  reply_in_thread: MessageCircle,
  helpful: ThumbsUp,
  post_hidden: EyeOff,
  reply_hidden: EyeOff,
  follow_request: UserPlus,
  new_follower: UserPlus,
  follow_accepted: UserCheck,
  followed_post: MessageCircle,
  budget_near: PiggyBank,
  budget_over: CircleAlert,
  recap_ready: CalendarCheck,
  answer_accepted: CheckCircle2,
  year_ready: CalendarRange,
  networth_reminder: Landmark,
  bill_soon: Receipt,
  bill_today: Receipt,
};

// The bell in the header: an unread count that refreshes on navigation and every minute,
// and a panel listing recent notifications
function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let current = true;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      api
        .get("/notifications/unread-count")
        .then((res) => current && setUnread(res.data.unread))
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const stop = onNotificationsChange(refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      current = false;
      clearInterval(timer);
      stop();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      api
        .get("/notifications")
        .then((res) => {
          setItems(res.data.notifications);
          setUnread(res.data.unread);
        })
        .catch(() => setItems([]));
    }
    setOpen(!open);
  };

  const openNotification = (n: AppNotification) => {
    setOpen(false);
    if (!n.read) {
      api.post(`/notifications/${n.id}/read`).then(announceNotificationsChange).catch(() => {});
    }
    navigate(notificationLink(n));
  };

  const markAllRead = async () => {
    await api.post("/notifications/read-all").catch(() => {});
    setItems((current) => current?.map((n) => ({ ...n, read: true })) ?? null);
    setUnread(0);
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative p-2 rounded-xl text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-loss text-white text-[11px] font-semibold leading-[18px] text-center tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="font-semibold text-ink-900">Notifications</p>
            {items?.some((n) => !n.read) && (
              <button onClick={markAllRead} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Mark all as read
              </button>
            )}
          </div>
          {items === null ? (
            <p className="px-4 py-6 text-sm text-ink-500">Loading…</p>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={22} className="mx-auto text-ink-300" />
              <p className="mt-2 text-sm text-ink-500">
                Nothing yet. You'll hear here when someone replies to you or follows you, and when you're close to a budget.
              </p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-line">
              {items.map((n) => {
                const Icon = ICONS[n.kind] ?? MessageCircle;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openNotification(n)}
                      className={`w-full flex gap-3 px-4 py-3 text-left transition hover:bg-canvas ${n.read ? "" : "bg-brand-50/60"}`}
                    >
                      {n.actor ? (
                        <Avatar name={nameOf(n.actor)} avatarUrl={n.actor.avatarUrl} />
                      ) : (
                        <Icon size={16} className={`shrink-0 mt-0.5 ${n.read ? "text-ink-300" : "text-brand-600"}`} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.read ? "text-ink-700" : "text-ink-900 font-medium"}`}>{n.message}</span>
                        {n.title && <span className="block text-xs text-ink-500 truncate">{n.title}</span>}
                        <span className="block text-xs text-ink-400 mt-0.5">{timeAgo(n.updatedAt)}</span>
                      </span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0 mt-1.5" aria-label="Unread" />}
                    </button>
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

export default NotificationBell;
