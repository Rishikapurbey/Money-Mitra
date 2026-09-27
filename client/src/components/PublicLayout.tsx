import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Wallet } from "lucide-react";

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

const navLink = (active: boolean) =>
  `transition ${active ? "text-ink-900 font-semibold" : "text-ink-500 hover:text-ink-900"}`;

// Header and footer for pages visitors can see without an account
function PublicLayout() {
  const { pathname } = useLocation();
  const activeSection = useActiveSection(pathname === "/");
  const onLearn = pathname.startsWith("/learn");

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="bg-surface/90 backdrop-blur border-b border-line sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="bg-ink-900 p-2 rounded-lg">
              <Wallet className="text-brand-300" size={18} />
            </div>
            <span className="text-lg font-semibold tracking-tight text-ink-900">Money Mitra</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="/#features" className={navLink(activeSection === "features")}>Features</a>
            <Link to="/learn" className={navLink(onLearn)} aria-current={onLearn ? "page" : undefined}>Learn</Link>
            <a href="/#privacy" className={navLink(activeSection === "privacy")}>Privacy</a>
            <a href="/#faq" className={navLink(activeSection === "faq")}>FAQ</a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/login" className="px-3 sm:px-4 py-2 text-sm font-medium text-ink-700 hover:text-ink-900 transition">
              Log in
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>

      <footer className="bg-ink-950 text-ink-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 text-white">
              <div className="bg-ink-800 p-2 rounded-lg">
                <Wallet className="text-brand-300" size={18} />
              </div>
              <span className="text-lg font-semibold tracking-tight">Money Mitra</span>
            </div>
            <p className="mt-4 text-sm max-w-sm leading-relaxed">
              Your friend for money. Track where it goes, understand how it works, and ask anything without judgment.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Product</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href="/#features" className="hover:text-white transition">Features</a></li>
              <li><Link to="/learn" className="hover:text-white transition">Learn</Link></li>
              <li><a href="/#faq" className="hover:text-white transition">FAQ</a></li>
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
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row gap-3 justify-between text-xs text-ink-400">
            <p>© {new Date().getFullYear()} Money Mitra</p>
            <p className="max-w-xl sm:text-right">
              Money Mitra is for education and personal tracking only. It is not financial, tax or investment advice.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;
