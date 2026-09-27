import { useSyncExternalStore } from "react";

// True while the CSS media query matches, e.g. useMediaQuery("(min-width: 1280px)")
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches
  );
}

// Wide enough for a page's main column plus a side rail (Tailwind's xl breakpoint)
export const useWideLayout = () => useMediaQuery("(min-width: 1280px)");
