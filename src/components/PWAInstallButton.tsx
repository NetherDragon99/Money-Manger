import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Check, RefreshCw, Smartphone, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { checkForAppUpdates, applyLatestAppUpdate } from '../utils/versionChecker';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, install, isIOS } = usePWAInstall();
  const { t, settings, showToast } = useApp();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [showAndroidInstallHelp, setShowAndroidInstallHelp] = useState(false);

  const handleInstallToHomeScreen = async () => {
    if (isInstallable) {
      try {
        const accepted = await install();
        if (accepted) {
          showToast(
            settings.language === 'ar'
              ? 'تم تثبيت التطبيق على الشاشة الرئيسية كـ تطبيق مستقل بدون شريط متصفح!'
              : 'App installed to Home Screen as a standalone app with no browser bar!',
            'success'
          );
          return;
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }

    // If deferredPrompt is not available (e.g. Chrome already shown it or browser requires manual menu tap)
    setShowAndroidInstallHelp(true);
  };

  const handleManualUpdateCheck = async () => {
    setCheckingUpdate(true);
    try {
      const result = await checkForAppUpdates();
      if (result.hasUpdate) {
        showToast(
          settings.language === 'ar'
            ? `تم العثور على إصدار أحدث (v${result.latestVersion}). جارٍ التحديث الآن...`
            : `New version found (v${result.latestVersion}). Updating now...`,
          'info'
        );
        setTimeout(() => {
          applyLatestAppUpdate();
        }, 800);
      } else {
        showToast(
          settings.language === 'ar'
            ? 'تطبيقك مُحدّث بالكامل إلى أحدث إصدار!'
            : 'Your app is up to date with the latest version!',
          'success'
        );
      }
    } catch {
      showToast('Could not check for updates right now', 'error');
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <>
      <div className="space-y-2 w-full">
        {isInstalled ? (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <Check className="w-4 h-4 shrink-0" />
              <span>{settings.language === 'ar' ? 'مثبت على الشاشة الرئيسية (بدون شريط متصفح)' : 'Installed on Home Screen (Standalone)'}</span>
            </div>
            <button
              type="button"
              onClick={handleManualUpdateCheck}
              disabled={checkingUpdate}
              aria-label="Check for updates"
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleInstallToHomeScreen}
            className={`flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-medium shadow-lg shadow-blue-900/30 transition cursor-pointer ${
              compact ? 'px-3 py-1.5 text-xs' : 'w-full py-2.5 text-sm'
            }`}
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{settings.language === 'ar' ? 'تثبيت على الشاشة الرئيسية' : 'Install to Home Screen'}</span>
          </button>
        )}
      </div>

      {/* Direct install guidance when browser does not fire prompt automatically */}
      {showAndroidInstallHelp && !isInstalled && (
        <div
          onClick={() => setShowAndroidInstallHelp(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm max-h-[92dvh] overflow-y-auto my-auto rounded-3xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl text-white space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  {settings.language === 'ar' ? 'تثبيت كتطبيق مستقل بدون شريط متصفح' : 'Install Standalone (No Browser Bar)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAndroidInstallHelp(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-zinc-300 space-y-2 leading-relaxed bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
              <p className="font-semibold text-white">
                {settings.language === 'ar'
                  ? 'لتثبيته كتطبيق مستقل يفتح بدون شريط بحث أو رأس المتصفح:'
                  : 'To install with zero address bar or browser header:'}
              </p>
              {isIOS ? (
                <ol className="list-decimal list-inside space-y-1 text-zinc-300">
                  <li>{settings.language === 'ar' ? 'اضغط على زر المشاركة (Share) في Safari.' : 'Tap Share in Safari.'}</li>
                  <li>{settings.language === 'ar' ? 'اختر "إضافة إلى الشاشة الرئيسية".' : 'Select "Add to Home Screen".'}</li>
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-300">
                  <li>
                    {settings.language === 'ar'
                      ? 'اضغط على قائمة المتصفح (⋮) في أعلى الزاوية.'
                      : 'Tap the three dots (⋮) in your browser corner.'}
                  </li>
                  <li>
                    {settings.language === 'ar'
                      ? 'اختر "تثبيت التطبيق" (Install app) أو "إضافة إلى الشاشة الرئيسية".'
                      : 'Select "Install app" or "Add to Home screen".'}
                  </li>
                  <li>
                    {settings.language === 'ar'
                      ? 'افتحه من شاشتك الرئيسية وسيعمل بحجم الشاشة الكامل وبدون إنترنت!'
                      : 'Open it from your home screen and it will run in pure fullscreen offline!'}
                  </li>
                </ol>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAndroidInstallHelp(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg"
            >
              {settings.language === 'ar' ? 'حسناً، فهمت' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
