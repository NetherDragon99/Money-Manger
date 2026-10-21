import { useApp } from '../context/AppContext';

/**
 * Smart Auto-Hiding Header on Scroll (Item 3)
 * Synchronized with root layout onScrollCapture in App.tsx:
 * - Scroll up deltaY < -2 OR scrollTop <= 25 -> Instant show
 * - Scroll down deltaY > 10 AND scrollTop > 60 -> Slide out
 * - Tab change -> Resets to visible
 */
export function useHeaderScroll() {
  const { isHeaderVisible } = useApp();
  return isHeaderVisible;
}
