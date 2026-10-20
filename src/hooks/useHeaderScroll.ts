import { useState, useEffect, useRef } from 'react';

/**
 * Smart Auto-Hiding Header on Scroll (Item 4)
 * Detects directional scroll across window and any scrollable container:
 * - Scrolling DOWN hides the header (-translate-y-full)
 * - Scrolling UP by even a tiny threshold (deltaY < -4px) immediately slides header back into view (translate-y-0)
 */
export function useHeaderScroll(threshold = 40) {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = (e: Event) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const target = e.target as HTMLElement | Document | null;
          let currentY = window.scrollY || document.documentElement.scrollTop || 0;

          if (target && target instanceof HTMLElement && target.scrollTop !== undefined && target.scrollTop > 0) {
            currentY = Math.max(currentY, target.scrollTop);
          }

          const delta = currentY - lastScrollY.current;

          if (currentY <= threshold) {
            // Near top -> always visible
            setIsHeaderVisible(true);
          } else if (delta < -3) {
            // Scrolling UP -> Instant reappearance!
            setIsHeaderVisible(true);
          } else if (delta > 6 && currentY > threshold) {
            // Scrolling DOWN -> Slide out
            setIsHeaderVisible(false);
          }

          lastScrollY.current = Math.max(0, currentY);
          ticking = false;
        });
        ticking = true;
      }
    };

    // Attach to document with capture: true to intercept internal scroll containers
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [threshold]);

  return isHeaderVisible;
}
