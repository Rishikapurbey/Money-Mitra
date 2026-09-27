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
      // Wait a frame so the section exists when arriving from another page
      const frame = requestAnimationFrame(() =>
        document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" })
      );
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);

  return null;
}

export default ScrollManager;
