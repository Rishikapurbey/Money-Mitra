import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

// A small button that appears on a long page when you start scrolling back up, the moment you're
// likely to want it. On phones it's a pill in the middle, clear of the ⋯ menus at the end of each
// row; it also steps aside near the end of the page.
function BackToTop({ className = "bottom-6" }: { className?: string }) {
  const [visible, setVisible] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const update = () => {
      const y = window.scrollY;
      const goingUp = y < lastY.current;
      lastY.current = y;
      const nearEnd = window.innerHeight + y > document.documentElement.scrollHeight - 200;
      setVisible(y > 900 && goingUp && !nearEnd);
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  if (!visible) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className={`fixed z-20 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 flex items-center gap-1.5 px-3.5 py-2 sm:p-3 rounded-full bg-surface border border-line shadow-lg text-sm font-medium text-ink-700 hover:text-ink-900 hover:border-ink-300 transition ${className}`}
    >
      <ArrowUp size={16} />
      <span className="sm:hidden">Top</span>
    </button>
  );
}

export default BackToTop;
