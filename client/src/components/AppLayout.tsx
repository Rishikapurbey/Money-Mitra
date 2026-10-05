import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { House, PieChart, MessagesSquare, BookOpen, LogOut, ChevronDown, Calculator, Settings, Download, UserRound, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import api from "../lib/api";
import { Logo } from "./Logo";
import { pageWidth } from "../lib/ui";
import BackToTop from "./BackToTop";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import { useInstallPrompt } from "../lib/installPrompt";
import { useToast } from "../lib/toast";
import { announceDataChange, announceNotificationsChange } from "../lib/dataEvents";
import { nameOf } from "../lib/me";
import type { Me } from "../lib/me";
import Avatar from "./Avatar";
import PageBoundary from "./PageBoundary";
import VerifyEmailBanner from "./VerifyEmailBanner";

export interface AppContext {
  // null until loaded
  me: Me | null;
  updateMe: (changes: Partial<Me>) => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
  // Left out of the phone tab bar, which has room for five; reached from the Tracker there
  wideOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: "/home", label: "Home", icon: House },
  { to: "/tracker", label: "Tracker", icon: PieChart },
  { to: "/shared", label: "Shared", icon: UsersRound, wideOnly: true },
  { to: "/discuss", label: "Discuss", icon: MessagesSquare },
  { to: "/learn", label: "Learn", icon: BookOpen },
  { to: "/calculators", label: "Calculators", icon: Calculator },
];

const soonBadge = "text-[10px] font-semibold uppercase tracking-wider text-ink-400 bg-ink-100 px-1.5 py-0.5 rounded";

function AppLayout() {
  const [me, setMe] = useState<Me | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const toast = useToast();

  useEffect(() => {
    api.get("/auth/me").then((res) => setMe(res.data.user)).catch(() => {});
  }, []);

  const updateMe = useCallback((changes: Partial<Me>) => setMe((prev) => (prev ? { ...prev, ...changes } : prev)), []);

  // Add any recurring transactions that became due since the last visit, then let pages refresh
  useEffect(() => {
    api
      .post("/recurring/run")
      .then((res) => {
        const added: { category: string; count: number }[] = res.data.added;
        // Bill reminders may have just gone to the bell
        if (res.data.reminded > 0) announceNotificationsChange();
        if (added.length === 0) return;
        const total = added.reduce((sum, a) => sum + a.count, 0);
        toast({
          message: `${total} recurring transaction${total === 1 ? " was" : "s were"} added: ${added.map((a) => a.category).join(", ")}`,
        });
        announceDataChange();
        // Recurring expenses can set off budget alerts
        announceNotificationsChange();
      })
      .catch(() => {});
  }, [toast]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const install = useInstallPrompt();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-canvas pb-20 md:pb-0">
      <header className="bg-surface border-b border-line sticky top-0 z-20">
        <div className={`${pageWidth} h-16 flex items-center gap-8`}>
          <NavLink to="/home" aria-label="Money Mitra home" className="shrink-0">
            <Logo />
          </NavLink>

          <nav className="hidden md:flex items-center gap-1 h-full">
            {navItems.map(({ to, label, soon }) =>
              soon ? (
                <span key={to} className="flex items-center gap-2 px-3 text-sm font-medium text-ink-400 cursor-default">
                  {label} <span className={soonBadge}>Soon</span>
                </span>
              ) : (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `h-full flex items-center px-3 text-sm font-medium border-b-2 transition ${
                      isActive ? "border-brand-600 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900"
                    }`
                  }
                >
                  {label}
                </NavLink>
              )
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-ink-100 transition"
              >
                {me ? <Avatar name={nameOf(me)} avatarUrl={me.avatarUrl} /> : <span className="w-8 h-8 rounded-full bg-ink-100" />}
                <span className="hidden sm:block text-sm font-medium text-ink-700">{me && nameOf(me)}</span>
                <ChevronDown size={16} className="text-ink-400" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-52 bg-surface border border-line rounded-xl shadow-lg py-1">
                  <p className="px-4 py-2 text-xs text-ink-500 border-b border-line">
                    Signed in as <span className="font-medium text-ink-900">@{me?.username}</span>
                  </p>
                  {me && (
                    <Link
                      to={`/u/${me.username}`}
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-100 transition"
                    >
                      <UserRound size={16} /> Your profile
                    </Link>
                  )}
                  <Link
                    to="/settings"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-100 transition"
                  >
                    <Settings size={16} /> Settings
                  </Link>
                  {install && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        install();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-100 transition"
                    >
                      <Download size={16} /> Install app
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-100 transition"
                  >
                    <LogOut size={16} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {me && !me.emailVerified && <VerifyEmailBanner email={me.email} />}

      <PageBoundary>
        <Outlet context={{ me, updateMe } satisfies AppContext} />
      </PageBoundary>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-line grid grid-cols-5">
        {navItems.filter((item) => !item.wideOnly).map(({ to, label, icon: Icon, soon }) =>
          soon ? (
            <span key={to} className="flex flex-col items-center gap-1 py-2.5 text-ink-300">
              <Icon size={20} />
              <span className="text-[11px] font-medium">{label} · Soon</span>
            </span>
          ) : (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 transition ${isActive ? "text-brand-600" : "text-ink-500"}`
              }
            >
              <Icon size={20} />
              <span className="text-[11px] font-medium">{label}</span>
            </NavLink>
          )
        )}
      </nav>

      {/* Sits above the phone tab bar */}
      <BackToTop className="bottom-24 md:bottom-6" />
    </div>
  );
}

export default AppLayout;
