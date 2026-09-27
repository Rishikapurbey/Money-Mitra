import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Wallet, LayoutDashboard, MessagesSquare, BookOpen, LogOut, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import api from "../lib/api";

export interface AppContext {
  username: string;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
}

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/discuss", label: "Discuss", icon: MessagesSquare },
  { to: "/learn", label: "Learn", icon: BookOpen, soon: true },
];

const soonBadge = "text-[10px] font-semibold uppercase tracking-wider text-ink-400 bg-ink-100 px-1.5 py-0.5 rounded";

function AppLayout() {
  const [username, setUsername] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/auth/me").then((res) => setUsername(res.data.user.username)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-canvas pb-20 md:pb-0">
      <header className="bg-surface border-b border-line sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-8">
          <NavLink to="/dashboard" className="flex items-center gap-2.5">
            <div className="bg-ink-900 p-2 rounded-lg">
              <Wallet className="text-brand-300" size={18} />
            </div>
            <span className="text-lg font-semibold tracking-tight text-ink-900">Money Mitra</span>
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

          <div ref={menuRef} className="relative ml-auto">
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-ink-100 transition"
            >
              <span className="w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-semibold flex items-center justify-center">
                {username ? username.charAt(0).toUpperCase() : ""}
              </span>
              <span className="hidden sm:block text-sm font-medium text-ink-700">{username}</span>
              <ChevronDown size={16} className="text-ink-400" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-52 bg-surface border border-line rounded-xl shadow-lg py-1">
                <p className="px-4 py-2 text-xs text-ink-500 border-b border-line">
                  Signed in as <span className="font-medium text-ink-900">{username}</span>
                </p>
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
      </header>

      <Outlet context={{ username } satisfies AppContext} />

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-line grid grid-cols-3">
        {navItems.map(({ to, label, icon: Icon, soon }) =>
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
    </div>
  );
}

export default AppLayout;
