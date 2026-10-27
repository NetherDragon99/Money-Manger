import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  badge?: string | number;
  badgeColor?: string;
}

export interface SwipeableTabsProps {
  tabs: [TabItem, TabItem];
  activeTab: string;
  onChange: (tabId: string) => void;
  children: [React.ReactNode, React.ReactNode];
  className?: string;
  tabBarClassName?: string;
  pillColorClass?: string;
  pillActiveClass?: [string, string]; // [tab0PillClass, tab1PillClass]
  onBoundaryDrag?: (direction: 'start' | 'end', deltaX: number, phase: 'start' | 'move' | 'end') => void;
  disableBoundaryHandOff?: boolean;
}

export const SwipeableTabs: React.FC<SwipeableTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  children,
  className = '',
  tabBarClassName = '',
  pillColorClass,
  pillActiveClass,
  onBoundaryDrag,
  disableBoundaryHandOff = false,
}) => {
  const { settings } = useApp();
  const isRtl = settings.language === 'ar';

  const activeIndex = tabs[0].id === activeTab ? 0 : 1;
  const containerRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Live progress between 0 (tab 0) and 1 (tab 1)
  const [dragProgress, setDragProgress] = useState<number>(activeIndex);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isScrubbingTabBar, setIsScrubbingTabBar] = useState<boolean>(false);

  const dragProgressRef = useRef<number>(activeIndex);
  dragProgressRef.current = dragProgress;

  // Reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const animFrameRef = useRef<number | null>(null);

  // Declare callbacks above any handlers to prevent any TDZ access
  const updateProgress = useCallback((newProg: number) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      setDragProgress(newProg);
    });
  }, []);

  // Helper to dispatch global sidebar drag events for 1:1 finger tracking
  const dispatchSidebarEvent = useCallback((phase: 'start' | 'move' | 'end', deltaX: number, clientX: number) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('mm-sidebar-drag', {
        detail: { phase, deltaX, clientX, isRtl },
      })
    );
  }, [isRtl]);

  // Sync internal progress when external activeTab changes (when not actively dragging)
  useEffect(() => {
    if (!isDragging && !isScrubbingTabBar) {
      setDragProgress(activeIndex);
    }
  }, [activeIndex, isDragging, isScrubbingTabBar]);

  // Clean up any pending animation frames on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Touch tracking state
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    startTime: number;
    isHorizontalLock: boolean | null;
    isBoundaryEngaged: 'start' | 'end' | null;
    isEdgeZone: boolean;
  }>({
    startX: 0,
    startY: 0,
    lastX: 0,
    startTime: 0,
    isHorizontalLock: null,
    isBoundaryEngaged: null,
    isEdgeZone: false,
  });

  // Content touch handlers (Carousel)
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Ignore interactive elements
    if (
      target.closest(
        'input, textarea, select, button, [data-no-swipe], [data-no-drag], .no-swipe, .overflow-x-auto, svg, canvas, .recharts-responsive-container'
      )
    ) {
      return;
    }

    const touch = e.touches[0];
    const screenWidth = window.innerWidth;
    const isEdgeZone = isRtl
      ? touch.clientX >= screenWidth - 28
      : touch.clientX <= 28;

    touchStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      startTime: Date.now(),
      isHorizontalLock: null,
      isBoundaryEngaged: null,
      isEdgeZone,
    };
    // Note: Do NOT engage boundary or call preventDefault on touchstart so vertical scroll starts clean
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const { startX, startY, isHorizontalLock, isBoundaryEngaged, isEdgeZone } = touchStateRef.current;
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    // Boundary already engaged: hand off to sidebar/main drawer
    if (isBoundaryEngaged) {
      onBoundaryDrag?.(isBoundaryEngaged, deltaX, 'move');
      if (isBoundaryEngaged === 'start') {
        dispatchSidebarEvent('move', deltaX, touch.clientX);
      }
      return;
    }

    // Direction locking:
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (isHorizontalLock === null) {
      // If finger moves vertically first, cancel horizontal lock immediately to preserve native vertical scroll
      if (absY > 8 && absY >= absX) {
        touchStateRef.current.isHorizontalLock = false;
        setIsDragging(false);
        return;
      }

      // Wait until finger moves at least 12px
      if (absX < 12 && absY < 12) return;

      // if Math.abs(dy) >= Math.abs(dx), immediately cancel the horizontal drag state so vertical scrolling proceeds uninterrupted
      if (absY >= absX) {
        touchStateRef.current.isHorizontalLock = false;
        setIsDragging(false);
        return;
      }

      // only engage horizontal translation when Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 12
      if (absX > absY * 1.5 && absX > 12) {
        touchStateRef.current.isHorizontalLock = true;
        setIsDragging(true);

        // Check if edge boundary should engage immediately
        if (isEdgeZone && !disableBoundaryHandOff) {
          touchStateRef.current.isBoundaryEngaged = 'start';
          setIsDragging(false);
          onBoundaryDrag?.('start', deltaX, 'start');
          dispatchSidebarEvent('start', deltaX, touch.clientX);
          return;
        }
      } else {
        return;
      }
    }

    if (!touchStateRef.current.isHorizontalLock) return;

    // Check boundary handoff:
    // When on tab 0, dragging toward start edge (right in LTR, left in RTL)
    const isDraggingToStart = isRtl ? deltaX < 0 : deltaX > 0;
    const isDraggingToEnd = isRtl ? deltaX > 0 : deltaX < 0;

    if (activeIndex === 0 && isDraggingToStart && !disableBoundaryHandOff) {
      touchStateRef.current.isBoundaryEngaged = 'start';
      setIsDragging(false);
      onBoundaryDrag?.('start', deltaX, 'start');
      dispatchSidebarEvent('start', deltaX, touch.clientX);
      return;
    }

    if (activeIndex === 1 && isDraggingToEnd && !disableBoundaryHandOff) {
      touchStateRef.current.isBoundaryEngaged = 'end';
      setIsDragging(false);
      onBoundaryDrag?.('end', deltaX, 'start');
      return;
    }

    // Normal 1:1 internal carousel drag
    const containerWidth = containerRef.current?.offsetWidth || window.innerWidth || 360;
    const normDeltaRatio = (isRtl ? deltaX : -deltaX) / containerWidth;
    const newProg = Math.min(Math.max(activeIndex + normDeltaRatio, 0), 1);

    touchStateRef.current.lastX = touch.clientX;
    updateProgress(newProg);
  };

  const handleTouchCancel = () => {
    setIsDragging(false);
    setDragProgress(activeIndex);
    touchStateRef.current.isHorizontalLock = null;
    touchStateRef.current.isBoundaryEngaged = null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const { isBoundaryEngaged, startX, startTime, isHorizontalLock } = touchStateRef.current;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const duration = Math.max(Date.now() - startTime, 1);
    const velocity = Math.abs(deltaX) / duration; // px per ms

    if (isBoundaryEngaged) {
      onBoundaryDrag?.(isBoundaryEngaged, deltaX, 'end');
      if (isBoundaryEngaged === 'start') {
        dispatchSidebarEvent('end', deltaX, touch.clientX);
      }
      touchStateRef.current.isBoundaryEngaged = null;
      touchStateRef.current.isHorizontalLock = null;
      return;
    }

    if (isHorizontalLock) {
      setIsDragging(false);
      const curProg = dragProgressRef.current;
      const movedFromActive = Math.abs(curProg - activeIndex);

      // Snap decision: flicked fast or moved past 20%
      let targetIndex = activeIndex;
      if (movedFromActive > 0.2 || velocity > 0.25) {
        targetIndex = curProg > 0.5 ? 1 : 0;
      }

      setDragProgress(targetIndex);
      if (targetIndex !== activeIndex) {
        onChange(tabs[targetIndex].id);
      }
    }

    touchStateRef.current.isHorizontalLock = null;
  };

  // Top Segmented Tab Pill Scrubbing Handlers (Scrub top bar directly)
  const handlePillPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsScrubbingTabBar(true);
    const startClientX = e.clientX;
    const barWidth = tabBarRef.current?.offsetWidth || 200;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startClientX;
      const ratio = (isRtl ? -deltaX : deltaX) / (barWidth / 2);
      const newProg = Math.min(Math.max(activeIndex + ratio, 0), 1);
      updateProgress(newProg);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };

    const onPointerCancel = () => {
      cleanup();
      setIsScrubbingTabBar(false);
      setDragProgress(activeIndex);
    };

    const onPointerUp = (ev: PointerEvent) => {
      cleanup();
      setIsScrubbingTabBar(false);

      const deltaX = ev.clientX - startClientX;
      const targetIndex = Math.abs(deltaX) > 20
        ? (dragProgressRef.current > 0.5 ? 1 : 0)
        : activeIndex;

      setDragProgress(targetIndex);
      if (targetIndex !== activeIndex) {
        onChange(tabs[targetIndex].id);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  };

  // Active pill color calculation
  const currentPillClass = pillActiveClass
    ? (dragProgress > 0.5 ? pillActiveClass[1] : pillActiveClass[0])
    : (pillColorClass || 'bg-zinc-800 text-white shadow-sm');

  // Carousel translation:
  const trackTransform = isRtl
    ? `translate3d(${dragProgress * 100}%, 0, 0)`
    : `translate3d(-${dragProgress * 100}%, 0, 0)`;

  // Tab indicator pill translation:
  const pillTransform = isRtl
    ? `translate3d(-${dragProgress * 100}%, 0, 0)`
    : `translate3d(${dragProgress * 100}%, 0, 0)`;

  const transitionStyle = isDragging || isScrubbingTabBar || prefersReducedMotion
    ? 'none'
    : 'transform 260ms cubic-bezier(0.25, 1, 0.5, 1)';

  return (
    <div className={`w-full flex flex-col min-h-0 flex-1 ${className}`}>
      {/* 1. Top Segmented Tab Bar With 1:1 Live Scrubbing */}
      <div className={`px-4 pt-2 pb-1 max-w-2xl mx-auto w-full ${tabBarClassName}`}>
        <div
          ref={tabBarRef}
          className="relative flex p-1 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 overflow-hidden select-none touch-pan-y"
          style={{ touchAction: 'pan-y' }}
        >
          {/* 1:1 Synchronized Sliding Indicator Pill */}
          <div
            onPointerDown={handlePillPointerDown}
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-all cursor-grab active:cursor-grabbing shadow-md z-0 ${currentPillClass}`}
            style={{
              transform: pillTransform,
              transition: transitionStyle,
            }}
          />

          {/* Tab 0 Button */}
          <button
            type="button"
            onClick={() => {
              setDragProgress(0);
              onChange(tabs[0].id);
            }}
            className={`relative z-10 flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              dragProgress < 0.5 ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tabs[0].icon}
            <span>{tabs[0].label}</span>
            {tabs[0].count !== undefined && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-800/80 text-zinc-300">
                {tabs[0].count}
              </span>
            )}
          </button>

          {/* Tab 1 Button */}
          <button
            type="button"
            onClick={() => {
              setDragProgress(1);
              onChange(tabs[1].id);
            }}
            className={`relative z-10 flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              dragProgress >= 0.5 ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tabs[1].icon}
            <span>{tabs[1].label}</span>
            {tabs[1].count !== undefined && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-800/80 text-zinc-300">
                {tabs[1].count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. 1:1 Horizontal Drag Carousel Track & Panes */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className="w-full flex-1 min-h-0 overflow-hidden relative touch-pan-y"
        style={{ touchAction: 'pan-y' }}
      >
        <div
          className="flex flex-row w-full h-full will-change-transform touch-pan-y"
          style={{
            touchAction: 'pan-y',
            transform: trackTransform,
            transition: transitionStyle,
          }}
        >
          {/* Tab Pane 0 */}
          <div
            className="w-full flex-shrink-0 min-w-full h-full overflow-y-auto overscroll-y-contain flex flex-col"
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              height: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              visibility: dragProgress >= 0.99 && !isDragging ? 'hidden' : 'visible',
            }}
          >
            {children[0]}
          </div>

          {/* Tab Pane 1 */}
          <div
            className="w-full flex-shrink-0 min-w-full h-full overflow-y-auto overscroll-y-contain flex flex-col"
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              height: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              visibility: dragProgress <= 0.01 && !isDragging ? 'hidden' : 'visible',
            }}
          >
            {children[1]}
          </div>
        </div>
      </div>
    </div>
  );
};
