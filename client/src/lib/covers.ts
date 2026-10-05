import type { CSSProperties } from "react";

// Built-in profile cover designs: calm, in the brand's deep tones, and the same in both themes.
// The keys match the server's list; `null` is the default teal band.
// `light` designs need dark text on top of them
export const COVER_DESIGNS: { key: string | null; label: string; style: CSSProperties; light?: boolean }[] = [
  {
    key: null,
    label: "Teal dots",
    style: {
      backgroundColor: "#0c5a54",
      backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.14) 1px, transparent 1px)",
      backgroundSize: "18px 18px",
    },
  },
  {
    key: "navy",
    label: "Navy lines",
    style: {
      backgroundColor: "#0f1b2d",
      backgroundImage: "repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 14px)",
    },
  },
  {
    key: "forest",
    label: "Forest grid",
    style: {
      backgroundColor: "#1f4d3a",
      backgroundImage:
        "linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px)",
      backgroundSize: "22px 22px",
    },
  },
  {
    key: "sand",
    label: "Sand dots",
    light: true,
    style: {
      backgroundColor: "#d9c9a8",
      backgroundImage: "radial-gradient(rgba(15, 27, 45, 0.16) 1px, transparent 1px)",
      backgroundSize: "18px 18px",
    },
  },
  {
    key: "slate",
    label: "Slate",
    style: { backgroundColor: "#3b4a5c" },
  },
  {
    key: "deepsea",
    label: "Deep sea",
    style: { backgroundImage: "linear-gradient(120deg, #0c5a54, #0f1b2d)" },
  },
];

export const coverDesign = (key: string | null) => COVER_DESIGNS.find((d) => d.key === key) ?? COVER_DESIGNS[0];
