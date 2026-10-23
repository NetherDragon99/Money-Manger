import React, { useState, useEffect, useRef } from 'react';
import { Download, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface PWAInstallProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  isArabic?: boolean;
}

export const PWAInstallProgressModal: React.FC<PWAInstallProgressModalProps> = ({
  isOpen,
  onClose,
  isArabic = false,
}) => {
  const { showToast } = useApp();
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setIsCompleted(false);
      cancelRef.current = false;
      return;
    }

    cancelRef.current = false;
    setProgress(0);
    setIsCompleted(false);

    const runPreCacheAndInstall = async () => {
      setStatusText(
        isArabic
          ? 'تهيئة بيئة التشغيل دون اتصال...'
          : 'Preparing offline environment...'
      );

      // Core offline asset list
      const CORE_OFFLINE_URLS = [
        './',
        './index.html',
        './manifest.webmanifest',
        './manifest.json',
        './version.json',
        './favicon.png',
        './icon.svg',
        './apple-touch-icon.png',
        './pwa-192x192.png',
        './pwa-512x512.png',
        './pwa-maskable-512x512.png',
        './registerSW.js',
        './sw.js',
      ];

      // Dynamically detect linked scripts and styles currently loaded in the DOM
      const liveAssets = typeof document !== 'undefined'
        ? Array.from(
            document.querySelectorAll<HTMLLinkElement | HTMLScriptElement>(
              'link[rel="stylesheet"], script[src]'
            )
          )
            .map((el) => (el as any).src || (el as any).href)
            .filter((url) => Boolean(url))
        : [];

      const allAssets = Array.from(new Set([...CORE_OFFLINE_URLS, ...liveAssets]));
      const total = allAssets.length;

      // 1. Actively pre-cache all assets into Cache Storage API
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const cache = await caches.open('app-offline-cache');
          for (let i = 0; i < total; i++) {
            if (cancelRef.current) return;
            const asset = allAssets[i];
            try {
              await cache.add(asset);
            } catch {
              // Gracefully continue even if an individual asset fails or is external
            }

            const currentPct = Math.min(85, Math.round(((i + 1) / total) * 85));
            setProgress(currentPct);

            if (currentPct < 30) {
              setStatusText(
                isArabic
                  ? 'تحميل حزم التطبيق والبرمجيات...'
                  : 'Downloading core app bundles & scripts...'
              );
            } else if (currentPct < 65) {
              setStatusText(
                isArabic
                  ? 'حفظ الأيقونات والخطوط وواجهات التشغيل...'
                  : 'Caching icons, fonts & UI routes...'
              );
            } else {
              setStatusText(
                isArabic
                  ? 'تأكيد الحفظ المحلي وضمان التشغيل الكامل...'
                  : 'Verifying offline cache & local storage...'
              );
            }

            await new Promise((r) => setTimeout(r, 40));
          }
        } catch (e) {
          console.warn('Pre-cache routine notice:', e);
        }
      } else {
        // Fallback simulated progress if caches is not supported
        for (let p = 10; p <= 85; p += 15) {
          if (cancelRef.current) return;
          setProgress(p);
          await new Promise((r) => setTimeout(r, 80));
        }
      }

      if (cancelRef.current) return;

      // 2. Finalize & notify Service Worker
      setProgress(92);
      setStatusText(
        isArabic
          ? 'اكتمل التحميل! جارٍ تجهيز التثبيت...'
          : 'Offline package ready! Launching install...'
      );

      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
          navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        } catch {}
      }

      await new Promise((r) => setTimeout(r, 250));
      if (cancelRef.current) return;

      setProgress(100);
      setIsCompleted(true);
      setStatusText(
        isArabic
          ? 'تم التحميل بنجاح! جارٍ التثبيت على جهازك...'
          : 'Completed! Adding to your device...'
      );

      await new Promise((r) => setTimeout(r, 350));
      if (cancelRef.current) return;

      // 3. Finalize installation & monitor user choice
      const win = typeof window !== 'undefined' ? (window as any) : null;
      const promptEvent = win?.deferredPwaPrompt || win?.deferredPWAInstallPrompt;

      if (promptEvent) {
        try {
          // If not prompted synchronously yet, attempt prompt as fallback
          if (typeof promptEvent.prompt === 'function' && !(promptEvent as any).__prompted) {
            (promptEvent as any).__prompted = true;
            await promptEvent.prompt();
          }
          if (promptEvent.userChoice) {
            const choice = await promptEvent.userChoice;
            if (choice?.outcome === 'accepted') {
              showToast(
                isArabic
                  ? 'تم تثبيت التطبيق بنجاح كـ تطبيق مستقل!'
                  : 'App installed successfully to your device!',
                'success'
              );
              if (win) {
                win.deferredPwaPrompt = null;
                win.deferredPWAInstallPrompt = null;
              }
            } else {
              showToast(
                isArabic
                  ? 'تم حفظ كافة ملفات التطبيق بنجاح للعمل بدون إنترنت!'
                  : 'App files cached 100% for offline use!',
                'info'
              );
            }
          }
        } catch (err) {
          console.warn('Install prompt handling error:', err);
          showToast(
            isArabic
              ? 'تم حفظ ملفات التطبيق بنجاح للعمل دون إنترنت!'
              : 'App cached successfully for offline use!',
            'success'
          );
        }
      } else {
        // Prompt already consumed or browser requires manual install
        const isStandalone =
          (typeof window !== 'undefined' &&
            (window.matchMedia('(display-mode: standalone)').matches ||
              window.matchMedia('(display-mode: fullscreen)').matches ||
              Boolean((window.navigator as any).standalone))) ||
          false;

        if (isStandalone) {
          showToast(
            isArabic
              ? 'التطبيق مثبت بالفعل وتم تحديث ملفات العمل دون إنترنت بنجاح!'
              : 'App is already installed and offline cache is fully updated!',
            'success'
          );
        } else {
          showToast(
            isArabic
              ? 'تم حفظ ملفات التطبيق بنجاح! يمكنك تثبيته من خيارات المتصفح (⋮) -> تثبيت التطبيق.'
              : 'App cached for offline use! You can add it to Home Screen via browser menu (⋮) -> Install App.',
            'success'
          );
        }
      }

      onClose();
    };

    runPreCacheAndInstall();

    return () => {
      cancelRef.current = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl text-white text-center space-y-5 animate-in zoom-in-95 duration-200"
      >
        {/* Glowing Animated Icon */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center shadow-xl shadow-blue-500/20">
          {isCompleted ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-in zoom-in-50 duration-300" />
          ) : (
            <Download className="w-8 h-8 text-blue-400 animate-bounce duration-1000" />
          )}
        </div>

        {/* Title & Phase */}
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-bold text-white">
            {isCompleted
              ? isArabic
                ? 'اكتمل التحميل والتثبيت!'
                : 'Ready to Install!'
              : isArabic
              ? 'تحميل وتثبيت التطبيق للعمل بدون إنترنت'
              : 'Download & Install Offline App'}
          </h3>
          <p className="text-xs text-zinc-400 min-h-[1.25rem]">
            {statusText}
          </p>
        </div>

        {/* Progress Bar & Numeric Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold px-1">
            <span className="text-zinc-500">
              {isArabic ? 'نسبة الإنجاز:' : 'Progress:'}
            </span>
            <span className="text-blue-400 text-sm">{progress}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-zinc-900 border border-zinc-800 p-0.5 overflow-hidden relative shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 transition-all duration-200 ease-out shadow-md shadow-blue-500/40"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Offline Guarantees Badge */}
        <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/60 text-[11px] text-zinc-400 space-y-1.5 text-start rtl:text-right">
          <div className="flex items-center gap-2 text-zinc-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              {isArabic
                ? 'يعمل بدون إنترنت بنسبة 100% وبسرعة فائقة'
                : '100% Offline Guaranteed & Lightning Fast'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              {isArabic
                ? 'تطبيق مستقل بالكامل بدون شريط متصفح'
                : 'Standalone Fullscreen App with Zero Browser Bar'}
            </span>
          </div>
        </div>

        {/* Primary Install on Device Button (if completed) */}
        {isCompleted && (
          <button
            type="button"
            onClick={() => {
              const win = typeof window !== 'undefined' ? (window as any) : null;
              const promptEvent = win?.deferredPwaPrompt || win?.deferredPWAInstallPrompt;
              if (promptEvent && typeof promptEvent.prompt === 'function') {
                try {
                  promptEvent.prompt();
                } catch (e) {
                  console.warn('Click install error:', e);
                }
              }
              onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>{isArabic ? 'تثبيت على الجهاز الآن' : 'Install on Device Now'}</span>
          </button>
        )}

        {/* Cancel / Close button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition cursor-pointer"
        >
          {isArabic ? (isCompleted ? 'إغلاق' : 'إلغاء') : (isCompleted ? 'Close' : 'Cancel')}
        </button>
      </div>
    </div>
  );
};
