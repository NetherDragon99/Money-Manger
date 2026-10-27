import React from 'react';
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
}) => {
  const { settings } = useApp();
  const isRtl = settings.language === 'ar';
  const activeIndex = tabs[0].id === activeTab ? 0 : 1;

  // Active pill color class
  const currentPillClass = pillActiveClass
    ? (activeIndex === 1 ? pillActiveClass[1] : pillActiveClass[0])
    : (pillColorClass || 'bg-zinc-800 text-white shadow-sm');

  // Tab indicator pill translation:
  const pillTransform = isRtl
    ? `translate3d(-${activeIndex * 100}%, 0, 0)`
    : `translate3d(${activeIndex * 100}%, 0, 0)`;

  return (
    <div className={`w-full flex flex-col min-h-0 ${className}`}>
      {/* 1. Top Segmented Tab Bar */}
      <div className={`px-4 pt-2 pb-2 max-w-2xl mx-auto w-full ${tabBarClassName}`}>
        <div
          className="relative flex p-1 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 overflow-hidden select-none"
        >
          {/* Synchronized Sliding Indicator Pill */}
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-transform duration-250 ease-out shadow-md z-0 ${currentPillClass}`}
            style={{
              transform: pillTransform,
            }}
          />

          {/* Tab 0 Button */}
          <button
            type="button"
            onClick={() => onChange(tabs[0].id)}
            className={`relative z-10 flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              activeIndex === 0 ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tabs[0].icon}
            <span>{tabs[0].label}</span>
            {tabs[0].count !== undefined && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300">
                {tabs[0].count}
              </span>
            )}
          </button>

          {/* Tab 1 Button */}
          <button
            type="button"
            onClick={() => onChange(tabs[1].id)}
            className={`relative z-10 flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              activeIndex === 1 ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tabs[1].icon}
            <span>{tabs[1].label}</span>
            {tabs[1].count !== undefined && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300">
                {tabs[1].count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Content: Direct natural page flow without nested overflow traps */}
      <div className="w-full flex flex-col min-h-0 flex-1">
        {activeIndex === 0 ? children[0] : children[1]}
      </div>
    </div>
  );
};
