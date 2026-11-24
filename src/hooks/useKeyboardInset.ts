import { useEffect } from 'react';

const FOCUSABLE_INPUT_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([readonly]), textarea:not([readonly]), select';

/**
 * Tracks mobile virtual keyboard occlusion using `window.visualViewport` without triggering
 * React state re-renders. Updates `--kb-inset` and `data-kb-open` on `document.documentElement`
 * via `requestAnimationFrame` and smoothly scrolls the active input inside its scroll container
 * so the app shell stays anchored while focused inputs remain comfortably above the keyboard.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const root = document.documentElement;
    let rafId: number | null = null;
    let scrollTimerId: number | null = null;
    let maxLayoutHeight = window.innerHeight;
    let lastInsetPx = -1;
    let lastOpenState = false;

    const applyInset = () => {
      rafId = null;
      const vv = window.visualViewport;
      if (!vv) {
        if (lastInsetPx !== 0) {
          root.style.setProperty('--kb-inset', '0px');
          lastInsetPx = 0;
        }
        if (lastOpenState) {
          root.removeAttribute('data-kb-open');
          lastOpenState = false;
        }
        return;
      }

      // Track baseline full-viewport height when keyboard is closed so devices that
      // shrink window.innerHeight or offsetTop still report accurate keyboard height.
      if (vv.height >= maxLayoutHeight - 40) {
        maxLayoutHeight = Math.max(maxLayoutHeight, window.innerHeight, vv.height);
      }

      const rawInset = Math.max(
        0,
        Math.round(window.innerHeight - vv.height - vv.offsetTop),
      );
      const fallbackInset = Math.max(
        0,
        Math.round(maxLayoutHeight - vv.height - vv.offsetTop),
      );
      const effectiveInset = rawInset > 20 ? rawInset : fallbackInset > 90 ? fallbackInset : 0;
      const clampedInset = effectiveInset > 80 ? effectiveInset : 0;

      if (clampedInset !== lastInsetPx) {
        root.style.setProperty('--kb-inset', `${clampedInset}px`);
        lastInsetPx = clampedInset;
      }

      const isOpen = clampedInset > 80;
      if (isOpen !== lastOpenState) {
        if (isOpen) {
          root.setAttribute('data-kb-open', 'true');
        } else {
          root.removeAttribute('data-kb-open');
        }
        lastOpenState = isOpen;
      }
    };

    const scheduleMeasure = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(applyInset);
    };

    const ensureFocusedInputVisible = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches(FOCUSABLE_INPUT_SELECTOR)) return;

      if (scrollTimerId !== null) {
        window.clearTimeout(scrollTimerId);
      }

      // Wait briefly for the virtual keyboard animation + `--kb-inset` padding to apply,
      // then scroll ONLY the nearest scrollable container without moving the window itself.
      scrollTimerId = window.setTimeout(() => {
        scrollTimerId = null;
        if (!document.contains(target)) return;
        try {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        } catch {
          target.scrollIntoView(true);
        }
        if (window.scrollY !== 0 || window.scrollX !== 0) {
          window.scrollTo(0, 0);
        }
      }, 140);
    };

    const handleFocusIn = (event: FocusEvent) => {
      scheduleMeasure();
      ensureFocusedInputVisible(event.target);
    };

    const handleFocusOut = () => {
      window.setTimeout(scheduleMeasure, 100);
    };

    const handleOrientationOrResize = () => {
      maxLayoutHeight = window.innerHeight;
      scheduleMeasure();
    };

    const vv = window.visualViewport;
    vv?.addEventListener('resize', scheduleMeasure, { passive: true });
    vv?.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('resize', handleOrientationOrResize, { passive: true });
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);

    applyInset();

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (scrollTimerId !== null) window.clearTimeout(scrollTimerId);
      vv?.removeEventListener('resize', scheduleMeasure);
      vv?.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', handleOrientationOrResize);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      root.style.removeProperty('--kb-inset');
      root.removeAttribute('data-kb-open');
    };
  }, []);
}
