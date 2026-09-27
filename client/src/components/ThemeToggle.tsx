import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "../lib/theme";

// A quick switch between light and dark; "follow my device" lives in Settings
function ThemeToggle() {
  const { isDark } = useTheme();
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="p-2 rounded-xl text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

export default ThemeToggle;
