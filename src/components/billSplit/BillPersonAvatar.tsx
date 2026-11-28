import React, { useEffect, useState } from 'react';

interface BillPersonAvatarProps {
  name: string;
  avatar?: string;
  photoURL?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

function getInitials(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join('').toUpperCase();
  return (Array.from(parts[0])[0] + Array.from(parts[parts.length - 1])[0]).toUpperCase();
}

export const BillPersonAvatar: React.FC<BillPersonAvatarProps> = ({
  name,
  avatar,
  photoURL,
  size = 'md',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [photoURL]);

  const cleanPhoto =
    photoURL &&
    photoURL.trim() &&
    (photoURL.startsWith('http://') ||
      photoURL.startsWith('https://') ||
      photoURL.startsWith('data:image/'))
      ? photoURL.trim()
      : '';

  const dimClass =
    size === 'xs'
      ? 'w-5 h-5 text-[10px] rounded-full'
      : size === 'sm'
      ? 'w-8 h-8 text-xs rounded-xl'
      : size === 'lg'
      ? 'w-12 h-12 text-lg rounded-2xl'
      : 'w-9 h-9 text-sm rounded-xl';

  if (cleanPhoto && !imgFailed) {
    return (
      <div
        className={`${dimClass} overflow-hidden shrink-0 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] select-none ${className}`}
      >
        <img
          src={cleanPhoto}
          alt={name || 'Member'}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover block"
          style={{ aspectRatio: '1 / 1' }}
        />
      </div>
    );
  }

  const hasCustomEmoji = avatar && avatar.trim() && avatar.trim() !== '👤';

  return (
    <div
      className={`${dimClass} shrink-0 flex items-center justify-center font-extrabold bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/25 select-none ${className}`}
    >
      {hasCustomEmoji ? (
        <span className="leading-none">{avatar}</span>
      ) : (
        <span dir="auto" className="leading-none tracking-tight">
          {getInitials(name)}
        </span>
      )}
    </div>
  );
};
