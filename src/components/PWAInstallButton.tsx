import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Check, Share2, X, Smartphone, Globe, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const { t, settings } = useApp();

  const handleButtonClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  return (
    <>
      {isInstalled ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-emerald-400">
          <Check className="w-4 h-4 shrink-0" />
          <span>{t('installedPWA')}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleButtonClick}
          className={`flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-medium shadow-lg shadow-blue-900/30 transition cursor-pointer ${
            compact ? 'px-3 py-1.5 text-xs' : 'w-full py-2.5 text-sm'
          }`}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>{t('installApp')}</span>
        </button>
      )}

      {/* Interactive Install Guide Modal */}
      {showGuideModal && (
        <div
          onClick={() => setShowGuideModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl text-white space-y-5"
          >
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  {settings.language === 'ar' ? 'تثبيت التطبيق على جهازك' : 'Install App to Device'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-zinc-300 leading-relaxed">
              {isIOS ? (
                /* iOS Instructions */
                <div className="space-y-2 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                  <div className="font-bold text-sm text-blue-400 flex items-center gap-1.5">
                    <Share2 className="w-4 h-4" />
                    <span>Apple iOS (Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-zinc-300">
                    <li>
                      {settings.language === 'ar'
                        ? 'اضغط على زر المشاركة (Share) في أسفل متصفح Safari.'
                        : 'Tap the Share icon at the bottom of Safari.'}
                    </li>
                    <li>
                      {settings.language === 'ar'
                        ? 'اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                        : 'Select "Add to Home Screen".'}
                    </li>
                    <li>
                      {settings.language === 'ar'
                        ? 'اضغط على "إضافة" (Add) لتثبيت التطبيق.'
                        : 'Tap "Add" in top-right to install the app.'}
                    </li>
                  </ol>
                </div>
              ) : isAndroid ? (
                /* Android / Chrome Instructions */
                <div className="space-y-2 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                  <div className="font-bold text-sm text-emerald-400 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" />
                    <span>Android (Chrome / Edge / Samsung)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-zinc-300">
                    <li>
                      {settings.language === 'ar'
                        ? 'اضغط على قائمة النقاط الثلاث (⋮) في أعلى زاوية المتصفح.'
                        : 'Tap the three-dots menu (⋮) in the top-right of your browser.'}
                    </li>
                    <li>
                      {settings.language === 'ar'
                        ? 'اضغط على "تثبيت التطبيق" (Install app) أو "إضافة إلى الشاشة الرئيسية".'
                        : 'Tap "Install app" or "Add to Home screen".'}
                    </li>
                    <li>
                      {settings.language === 'ar'
                        ? 'سيتم تثبيت التطبيق مباشرة كأيقونة تطبيق وتعمل بدون إنترنت!'
                        : 'The app will install as a native icon and work offline!'}
                    </li>
                  </ol>
                </div>
              ) : (
                /* Desktop / General Browser */
                <div className="space-y-2 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                  <div className="font-bold text-sm text-blue-400 flex items-center gap-1.5">
                    <Globe className="w-4 h-4" />
                    <span>Desktop (Chrome / Edge)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-zinc-300">
                    <li>
                      {settings.language === 'ar'
                        ? 'انقر على أيقونة التثبيت (Install) في شريط العنوان أعلى المتصفح.'
                        : 'Click the Install icon in the right side of the address bar.'}
                    </li>
                    <li>
                      {settings.language === 'ar'
                        ? 'أو اضغط على قائمة المتصفح (⋮) > ثم "تثبيت Personal Finance Tracker".'
                        : 'Or click browser menu (⋮) > "Install Personal Finance Tracker".'}
                    </li>
                  </ol>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {settings.language === 'ar'
                    ? 'هذا تطبيق ويب تقدمي (PWA) فوري، يعمل بالكامل بدون اتصال بالإنترنت ويحفظ بياناتك بأمان على جهازك.'
                    : 'This is an offline-first Progressive Web App (PWA). It runs standalone on your home screen with zero app store delays.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg"
            >
              {settings.language === 'ar' ? 'فهمت ذلك' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
