import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { pageWidth } from "../lib/ui";
import BackToTop from "./BackToTop";
import ThemeToggle from "./ThemeToggle";

const SECTIONS = ["features", "privacy", "faq"];

// The landing-page section currently under the top part of the screen, or "" (e.g. in the hero)
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState("");

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const line = window.innerHeight * 0.3;
      let current = "";
      for (const id of SECTIONS) {
        const rect = document.getElementById(id)?.getBoundingClientRect();
        if (rect && rect.top <= line && rect.bottom > line) current = id;
      }
      setActive(current);
    };
    const frame = requestAnimationFrame(update);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [enabled]);

  return enabled ? active : "";
}

interface NavItem {
  label: string;
  to: string;
  active: boolean;
}

// Header and footer for pages visitors can see without an account
function PublicLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onHome = pathname === "/";
  const activeSection = useActiveSection(onHome);
  const [menuOpen, setMenuOpen] = useState(false);

  const items: NavItem[] = [
    { label: "Home", to: "/", active: onHome && activeSection === "" },
    { label: "Features", to: "/#features", active: activeSection === "features" },
    { label: "Learn", to: "/learn", active: pathname.startsWith("/learn") },
    { label: "Calculators", to: "/calculators", active: pathname.startsWith("/calculators") },
    { label: "Privacy", to: "/#privacy", active: activeSection === "privacy" },
    { label: "FAQ", to: "/#faq", active: activeSection === "faq" },
  ];

  // "Home" while already on the landing page scrolls smoothly back to the top
  const handleNav = (e: React.MouseEvent, to: string) => {
    setMenuOpen(false);
    if (to === "/" && onHome) {
      e.preventDefault();
      navigate("/", { replace: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="bg-surface/90 backdrop-blur border-b border-line sticky top-0 z-30">
        <div className={`${pageWidth} h-16 flex items-center gap-8`}>
          <Link to="/" onClick={(e) => handleNav(e, "/")} aria-label="Money Mitra home" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium" aria-label="Main">
            {items.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={(e) => handleNav(e, item.to)}
                aria-current={item.active ? "page" : undefined}
                className={`transition ${item.active ? "text-ink-900 font-semibold" : "text-ink-500 hover:text-ink-900"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/login"
              className="hidden sm:block px-4 py-2 text-sm font-medium text-ink-700 hover:text-ink-900 transition"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition"
            >
              Get started
            </Link>
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="md:hidden p-2 -mr-2 rounded-lg text-ink-700 hover:bg-ink-100 transition"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id="mobile-menu" aria-label="Main" className="md:hidden border-t border-line bg-surface">
            <ul className={`${pageWidth} py-3 grid`}>
              {items.map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    onClick={(e) => handleNav(e, item.to)}
                    aria-current={item.active ? "page" : undefined}
                    className={`block px-3 py-3 rounded-lg transition ${
                      item.active ? "bg-brand-50 text-brand-700 font-semibold" : "text-ink-700 hover:bg-ink-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="mt-2 pt-3 border-t border-line">
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-3 rounded-lg font-medium text-ink-900 hover:bg-ink-100 transition"
                >
                  Log in
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <div className="flex-1">
        <Outlet />
      </div>

      <footer className="dark-panel bg-ink-950 text-ink-300">
        <div className={`${pageWidth} py-12 grid gap-10 md:grid-cols-4`}>
          <div className="md:col-span-2">
            <Logo tone="dark" />
            <p className="mt-4 text-sm max-w-sm leading-relaxed">
              Your friend for money. Track where it goes, understand how it works, and ask anything without judgment.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Product</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/#features" className="hover:text-white transition">Features</Link></li>
              <li><Link to="/learn" className="hover:text-white transition">Learn</Link></li>
              <li><Link to="/calculators" className="hover:text-white transition">Calculators</Link></li>
              <li><Link to="/#faq" className="hover:text-white transition">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Account</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/signup" className="hover:text-white transition">Create an account</Link></li>
              <li><Link to="/login" className="hover:text-white transition">Log in</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-ink-800">
          <div className={`${pageWidth} py-6 flex flex-col sm:flex-row gap-3 justify-between text-xs text-ink-400`}>
            <p>© {new Date().getFullYear()} Money Mitra</p>
            <p className="max-w-xl sm:text-right">
              Money Mitra is for education and personal tracking only. It is not financial, tax or investment advice.
            </p>
          </div>
        </div>
      </footer>

      <BackToTop />
    </div>
  );
}

export default PublicLayout;
