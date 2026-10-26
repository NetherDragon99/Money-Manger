import React from 'react';

export interface PWAInstallProgressModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  isArabic?: boolean;
}

/**
 * PWAInstallProgressModal is deprecated and unmounted.
 * Standalone PWA installation is performed directly and synchronously via native browser prompt (installPwa).
 */
export const PWAInstallProgressModal: React.FC<PWAInstallProgressModalProps> = () => {
  return null;
};
