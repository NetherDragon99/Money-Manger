import { useState, useEffect, useRef } from 'react';

/**
 * Smart Auto-Hiding Header on Scroll (Ultra-Sensitive Mobile & Touch-Aware)
 * - Dragging fingers down / Scrolling UP by even 1px -> Immediately slides header back into view
 * - Near top (currentY <= 50) -> Always visible
 * - Dragging fingers up / Scrolling DOWN by > 5px -> Slides out
 * - Tab / route switch -> Instantly visible
 */
export function useHeaderScroll(threshold = 50) {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const lastTouchY = useRef<number | null>(null);

  useEffect(() => {
    let ticking = false;

    // 1. Touch Move Listener for Instant Finger Drag Awareness
    const handleTouchStart = (e: TouchEvent) => {
      lastTouchY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (lastTouchY.current === null) {
        lastTouchY.current = e.touches[0].clientY;
        return;
      }

      const currentTouchY = e.touches[0].clientY;
      const touchDelta = currentTouchY - lastTouchY.current; // positive = dragging finger DOWN (scrolling UP)
      lastTouchY.current = currentTouchY;

      const currentScrollY =
        window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

      if (currentScrollY <= threshold || touchDelta > 2) {
        // Dragging finger DOWN to reveal top content -> Instant Header Reveal!
        setIsHeaderVisible(true);
      } else if (touchDelta < -6 && currentScrollY > threshold) {
        // Dragging finger UP to read down -> Slide header out
        setIsHeaderVisible(false);
      }
    };

    const handleTouchEnd = () => {
      lastTouchY.current = null;
    };

    // 2. Wheel & Scroll Event Listener
    const handleScroll = (e: Event) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY =
            window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

          const delta = currentY - lastScrollY.current;

          if (currentY <= threshold || delta < -1) {
            // Near top or scrolling UP by even 1px -> Instant show!
            setIsHeaderVisible(true);
          } else if (delta > 5 && currentY > threshold) {
            // Scrolling DOWN -> Slide out
            setIsHeaderVisible(false);
          }

          lastScrollY.current = Math.max(0, currentY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold]);

  return isHeaderVisible;
}
