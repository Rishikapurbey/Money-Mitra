import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// New pages open at the top, links like /#faq scroll to their section,
// and the back button keeps whatever position the browser restores.
// Changing only the query string (e.g. Tracker filters) keeps the current position.
function ScrollManager() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const lastPlace = useRef("");

  useEffect(() => {
    const place = pathname + hash;
    const samePlace = place === lastPlace.current;
    lastPlace.current = place;
    if (navigationType === "POP" || samePlace) return;
    if (hash) {
      // The section may not exist yet (e.g. still loading), so keep looking for up to 3 seconds.
      // Once found, content loading above it can push it down, so it's kept in view until the
      // page settles, unless the person starts scrolling themselves.
      let tries = 0;
      let found = 0;
      const stop = () => clearInterval(timer);
      const timer = setInterval(() => {
        const target = document.getElementById(hash.slice(1));
        if (!target) {
          if (++tries > 30) stop();
          return;
        }
        found += 1;
        if (found === 1) {
          target.scrollIntoView({ behavior: "smooth" });
        } else if (found > 8) {
          // After the smooth scroll has had time to finish, put it back if it was pushed away
          const wanted = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
          if (Math.abs(target.getBoundingClientRect().top - wanted) > 4) target.scrollIntoView();
        }
        if (found > 25) stop();
      }, 100);
      const userScroll = () => stop();
      window.addEventListener("wheel", userScroll, { passive: true });
      window.addEventListener("touchstart", userScroll, { passive: true });
      return () => {
        stop();
        window.removeEventListener("wheel", userScroll);
        window.removeEventListener("touchstart", userScroll);
      };
    }
    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);

  return null;
}

export default ScrollManager;
