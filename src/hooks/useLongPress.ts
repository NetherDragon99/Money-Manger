import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: (e: React.MouseEvent) => void;
  delay?: number;
  moveThreshold?: number;
}

export function useLongPress({
  onLongPress,
  onClick,
  delay = 450,
  moveThreshold = 12,
}: UseLongPressOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);

  const start = useCallback(
    (clientX: number, clientY: number) => {
      longPressTriggeredRef.current = false;
      startCoordsRef.current = { x: clientX, y: clientY };

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        try {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.(40);
          }
        } catch {}
        onLongPress();
      }, delay);
    },
    [onLongPress, delay]
  );

  const move = useCallback(
    (clientX: number, clientY: number) => {
      if (!startCoordsRef.current || !timerRef.current) return;
      const dx = Math.abs(clientX - startCoordsRef.current.x);
      const dy = Math.abs(clientY - startCoordsRef.current.y);
      if (dx > moveThreshold || dy > moveThreshold) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [moveThreshold]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      start(touch.clientX, touch.clientY);
    },
    [start]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      move(touch.clientX, touch.clientY);
    },
    [move]
  );

  const onTouchEnd = useCallback(() => {
    cancel();
  }, [cancel]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only primary mouse button
      start(e.clientX, e.clientY);
    },
    [start]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      move(e.clientX, e.clientY);
    },
    [move]
  );

  const onMouseUp = useCallback(() => {
    cancel();
  }, [cancel]);

  const onMouseLeave = useCallback(() => {
    cancel();
  }, [cancel]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (longPressTriggeredRef.current) {
        e.preventDefault();
        e.stopPropagation();
        longPressTriggeredRef.current = false;
        return;
      }
      onClick?.(e);
    },
    [onClick]
  );

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
      onClick: handleClick,
    },
    longPressTriggeredRef,
  };
}
