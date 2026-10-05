import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

// A small button that appears after scrolling down a long page. It steps aside near the end of
// the page, where it would cover the last row's buttons on a phone.
function BackToTop({ className = "bottom-6" }: { className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const nearEnd = window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 200;
      setVisible(window.scrollY > 900 && !nearEnd);
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  if (!visible) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className={`fixed right-4 sm:right-6 z-20 p-3 rounded-full bg-surface border border-line shadow-lg text-ink-700 hover:text-ink-900 hover:border-ink-300 transition ${className}`}
    >
      <ArrowUp size={18} />
    </button>
  );
}

export default BackToTop;
