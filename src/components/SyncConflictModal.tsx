import React, { useState } from 'react';
import { Cloud, RefreshCw, GitMerge, Download, ShieldCheck, Database, Smartphone, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SyncConflictModal: React.FC = () => {
  const { settings, pendingSyncConflict, resolveSyncConflict } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionChosen, setActionChosen] = useState<'replace' | 'merge' | null>(null);

  if (!pendingSyncConflict) return null;

  const isArabic = settings.language === 'ar';
  const { localCount, cloudCount, cloudAccountsCount, cloudProvider } = pendingSyncConflict;

  const handleAction = async (choice: 'replace' | 'merge') => {
    if (isProcessing) return;
    setIsProcessing(true);
    setActionChosen(choice);
    try {
      await resolveSyncConflict(choice);
    } catch (err) {
      console.warn('[SyncConflictModal] Error resolving conflict:', err);
    } finally {
      setIsProcessing(false);
      setActionChosen(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 sm:p-7 space-y-6 text-center relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-16 bg-blue-500/20 blur-2xl pointer-events-none rounded-full" />

        {/* Header Icon */}
        <div className="flex justify-center pt-2">
          <div className="relative">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-2 border-blue-500/40 text-blue-400 flex items-center justify-center shadow-xl shadow-blue-950/40">
              <Cloud className="w-8 h-8 text-blue-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-zinc-950 text-white flex items-center justify-center shadow-md">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {isArabic ? 'مزامنة بيانات الحساب' : 'Account Data Sync'}
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
            {isArabic
              ? 'تم العثور على نسخة احتياطية سحابية محفوظة لحسابك، وتوجد أيضاً بيانات مسجلة محلياً على هذا الجهاز. اختر كيف تود مزامنة بياناتك:'
              : 'A saved cloud backup was found for your account, and you also have records registered locally on this device. Choose how to synchronize your data:'}
          </p>
        </div>

        {/* Data Comparison Overview */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-center">
          {/* Local Device */}
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col items-center justify-center space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold">
              <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
              <span>{isArabic ? 'بيانات الجهاز الحالية' : 'Current Device'}</span>
            </div>
            <div className="text-lg font-black text-white font-mono">
              {localCount}
            </div>
            <div className="text-[10px] text-zinc-500">
              {isArabic ? 'معاملة مسجلة محلياً' : 'local transactions'}
            </div>
          </div>

          {/* Cloud Account */}
          <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 flex flex-col items-center justify-center space-y-1">
            <div className="flex items-center gap-1.5 text-blue-400 text-xs font-semibold">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>{isArabic ? 'النسخة السحابية' : 'Cloud Backup'}</span>
            </div>
            <div className="text-lg font-black text-blue-300 font-mono">
              {cloudCount}
            </div>
            <div className="text-[10px] text-blue-400/80 truncate">
              {cloudAccountsCount} {isArabic ? 'حساب' : 'accounts'} ({cloudProvider === 'google_drive' ? 'Google Drive' : 'Cloud Server'})
            </div>
          </div>
        </div>

        {/* Resolution Options */}
        <div className="space-y-3 pt-1">
          {/* Option 1: Replace Device Data with Account Data */}
          <button
            type="button"
            onClick={() => handleAction('replace')}
            disabled={isProcessing}
            className="w-full p-4 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-blue-500/30 hover:border-blue-500 text-left transition flex items-start gap-3.5 group cursor-pointer active:scale-98 shadow-md disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-600 group-hover:text-white transition">
              {isProcessing && actionChosen === 'replace' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-300 transition">
                {isArabic
                  ? 'استبدال بيانات الجهاز ببيانات الحساب'
                  : 'Replace Device Data with Account Data'}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                {isArabic
                  ? 'مسح البيانات المحلية على هذا الجهاز واستعادة بيانات حسابك السحابي المحفوظة بالكامل.'
                  : 'Wipe local device data and strictly restore your saved cloud account records.'}
              </div>
            </div>
          </button>

          {/* Option 2: Merge Current Device Data with Account Data */}
          <button
            type="button"
            onClick={() => handleAction('merge')}
            disabled={isProcessing}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-teal-950/40 hover:from-emerald-900/50 hover:to-teal-900/50 border border-emerald-500/40 hover:border-emerald-400 text-left transition flex items-start gap-3.5 group cursor-pointer active:scale-98 shadow-md shadow-emerald-950/20 disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-600 group-hover:text-white transition">
              {isProcessing && actionChosen === 'merge' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <GitMerge className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition">
                {isArabic
                  ? 'دمج البيانات الحالية مع بيانات الحساب'
                  : 'Merge Current Device Data with Account Data'}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                {isArabic
                  ? 'دمج المعاملات والحسابات والتصنيفات المحلية مع نسختك السحابية دون تكرار ومزامنة النتيجة فوراً.'
                  : 'Combine local transactions, accounts, and categories with cloud backup deduplicated by ID and sync merged state.'}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
