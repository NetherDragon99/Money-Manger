import React from 'react';
import { ArrowRight } from 'lucide-react';

interface TransferBadgeProps {
  fromIcon?: string;
  fromName?: string;
  fromColor?: string;
  toIcon?: string;
  toName?: string;
  toColor?: string;
  size?: 'sm' | 'md';
}

function renderAccountIcon(icon?: string, name?: string, defaultLetter = 'A') {
  const trimmedIcon = (icon || '').trim();
  if (trimmedIcon) {
    return <span className="leading-none">{trimmedIcon}</span>;
  }
  const letter = (name || defaultLetter).trim().charAt(0).toUpperCase() || defaultLetter;
  return <span className="font-bold text-[11px] leading-none tracking-tight text-zinc-200">{letter}</span>;
}

export const TransferBadge: React.FC<TransferBadgeProps> = ({
  fromIcon,
  fromName,
  fromColor,
  toIcon,
  toName,
  toColor,
  size = 'md',
}) => {
  const isSm = size === 'sm';

  const bubbleClass = isSm
    ? 'w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 transition'
    : 'w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-sm sm:text-base shrink-0 transition shadow-sm';

  const arrowClass = isSm
    ? 'w-3.5 h-3.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0'
    : 'w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-blue-500/25 text-blue-400 flex items-center justify-center shrink-0 shadow-sm';

  const arrowIconSize = isSm ? 'w-2 h-2 stroke-[2.5]' : 'w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[2.5]';

  return (
    <div
      className={`inline-flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 shrink-0 select-none ${
        isSm ? 'p-0.5' : 'p-1'
      }`}
    >
      {/* Source Account Bubble */}
      <div
        className={`${bubbleClass} bg-blue-500/15 border border-blue-500/30 text-blue-200`}
        style={fromColor ? { borderColor: `${fromColor}66` } : undefined}
        title={fromName || 'Source Account'}
      >
        {renderAccountIcon(fromIcon, fromName, 'S')}
      </div>

      {/* Sleek Directional Arrow Badge (flipped in RTL via rtl:rotate-180) */}
      <div className={arrowClass}>
        <ArrowRight className={`${arrowIconSize} rtl:rotate-180 transition-transform`} />
      </div>

      {/* Destination Account Bubble */}
      <div
        className={`${bubbleClass} bg-emerald-500/15 border border-emerald-500/30 text-emerald-200`}
        style={toColor ? { borderColor: `${toColor}66` } : undefined}
        title={toName || 'Destination Account'}
      >
        {renderAccountIcon(toIcon, toName, 'D')}
      </div>
    </div>
  );
};
