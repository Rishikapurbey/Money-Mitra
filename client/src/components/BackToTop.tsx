import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

// A small button that appears after scrolling down a long page
function BackToTop({ className = "bottom-6" }: { className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 900);
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
