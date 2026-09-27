import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// New pages open at the top, links like /#faq scroll to their section,
// and the back button keeps whatever position the browser restores.
function ScrollManager() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP") return;
    if (hash) {
      // The section may not exist yet (e.g. still loading), so keep looking for up to 3 seconds
      let tries = 0;
      const timer = setInterval(() => {
        const target = document.getElementById(hash.slice(1));
        if (target || ++tries > 30) clearInterval(timer);
        target?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return () => clearInterval(timer);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);

  return null;
}

export default ScrollManager;
