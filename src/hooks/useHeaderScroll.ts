import { useState, useEffect, useRef } from 'react';

/**
 * Smart Auto-Hiding Header on Scroll
 * Detects scroll direction:
 * - Scrolling DOWN hides the header (-translate-y-full)
 * - Scrolling UP shows the header (translate-y-0)
 */
export function useHeaderScroll(threshold = 50) {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY || document.documentElement.scrollTop || 0;
          const delta = currentY - lastScrollY.current;

          if (currentY <= threshold) {
            setIsHeaderVisible(true);
          } else if (delta > 8 && currentY > threshold) {
            // Scrolling DOWN
            setIsHeaderVisible(false);
          } else if (delta < -6) {
            // Scrolling UP
            setIsHeaderVisible(true);
          }

          lastScrollY.current = Math.max(0, currentY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return isHeaderVisible;
}
