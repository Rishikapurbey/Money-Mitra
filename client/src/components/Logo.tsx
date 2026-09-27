// The Money Mitra mark: two friends side by side whose shoulders form an M,
// the taller one (teal) helping the other up. Drawn in a 48x48 box.

type Tone = "light" | "dark";

const COLORS: Record<Tone, { main: string; accent: string }> = {
  light: { main: "#0f1b2d", accent: "#0f6f67" },
  dark: { main: "#ffffff", accent: "#5cc0ad" },
};

interface LogoMarkProps {
  // "light" for light backgrounds, "dark" for navy ones
  tone?: Tone;
  size?: number;
  className?: string;
}

export function LogoMark({ tone = "light", size = 32, className }: LogoMarkProps) {
  const { main, accent } = COLORS[tone];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
        <path d="M8 40L16.5 23.5L24 34" stroke={main} />
        <path d="M24 34L31.5 21L40 40" stroke={accent} />
      </g>
      <circle cx="16.5" cy="13.5" r="4.6" fill={main} />
      <circle cx="31.5" cy="10.5" r="4.6" fill={accent} />
    </svg>
  );
}

interface LogoProps {
  tone?: Tone;
  size?: number;
}

// The mark with the "Money Mitra" wordmark
export function Logo({ tone = "light", size = 30 }: LogoProps) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark tone={tone} size={size} />
      <span
        className={`font-display text-lg font-bold tracking-tight ${tone === "dark" ? "text-white" : "text-ink-900"}`}
      >
        Money <span className={tone === "dark" ? "text-[#5cc0ad]" : "text-brand-600"}>Mitra</span>
      </span>
    </span>
  );
}
