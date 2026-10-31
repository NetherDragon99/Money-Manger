import React from 'react';
import { X, Coins, ShieldAlert, RotateCcw, Info, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  DEFAULT_INSTAPAY_PRESET,
  resolveTransferFeeSettings,
} from '../utils/transferFee';

interface TransferFeesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransferFeesModal: React.FC<TransferFeesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, updateSettings, showToast, t } = useApp();
  const isArabic = settings.language === 'ar';

  if (!isOpen) return null;

  const feeCfg = resolveTransferFeeSettings(settings.transferFeeSettings);

  const updateFeeSettings = (nextPartial: Partial<typeof feeCfg>) => {
    updateSettings({
      transferFeeSettings: {
        instaPayPreset: {
          ...feeCfg.instaPayPreset,
          ...(nextPartial.instaPayPreset || {}),
        },
        defaultRule: {
          ...feeCfg.defaultRule,
          ...(nextPartial.defaultRule || {}),
        },
      },
    });
  };

  const handleResetInstaPay = () => {
    updateFeeSettings({
      instaPayPreset: { ...DEFAULT_INSTAPAY_PRESET },
    });
    showToast(
      isArabic
        ? 'تمت استعادة إعدادات إنستاباي الافتراضية'
        : 'InstaPay defaults restored',
      'info'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-zinc-100 min-w-0"
        onClick={(e) => e.stopPropagation()}
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-center justify-between shrink-0 bg-zinc-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-950/40">
              <Coins className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">
                {t('transferFeeSettingsTitle')}
              </h3>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {t('transferFeesModalDesc')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 min-w-0">
          {/* Section 1: InstaPay Quick Preset Defaults */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>{t('instaPayEditableDefaultsTitle')}</span>
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
                  {t('instaPayEditableDefaultsDesc')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-300">
                  {t('feeRatePercentLabel')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={feeCfg.instaPayPreset.ratePercent}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateFeeSettings({
                        instaPayPreset: {
                          ...feeCfg.instaPayPreset,
                          ratePercent: Number.isFinite(val) && val >= 0 ? val : 0,
                        },
                      });
                    }}
                    className="w-full min-h-[40px] px-3 py-1.5 pe-8 rounded-lg bg-zinc-900 border border-zinc-750 text-xs font-mono text-white outline-none focus:border-amber-500"
                  />
                  <span className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-zinc-400 pointer-events-none">
                    %
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-300">
                  {t('feeMinCapLabel')}
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={feeCfg.instaPayPreset.minFee}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateFeeSettings({
                      instaPayPreset: {
                        ...feeCfg.instaPayPreset,
                        minFee: Number.isFinite(val) && val >= 0 ? val : 0,
                      },
                    });
                  }}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-750 text-xs font-mono text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-300">
                  {t('feeMaxCapLabel')}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={feeCfg.instaPayPreset.maxFee}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateFeeSettings({
                      instaPayPreset: {
                        ...feeCfg.instaPayPreset,
                        maxFee: Number.isFinite(val) && val >= 0 ? val : 0,
                      },
                    });
                  }}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-750 text-xs font-mono text-white outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetInstaPay}
              className="w-full min-h-[40px] py-2 px-3 text-xs font-semibold text-zinc-400 hover:text-amber-300 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('resetInstaPayDefaultsBtn')}</span>
            </button>
          </div>

          {/* Section 2: Configurable Default Transfer Fee Rule */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3.5">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-zinc-200">
                {t('defaultTransferFeeRuleTitle')}
              </h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
                {t('defaultTransferFeeRuleDesc')}
              </p>
            </div>

            <select
              value={feeCfg.defaultRule.enabled ? feeCfg.defaultRule.ruleType : 'none'}
              onChange={(e) => {
                const mode = e.target.value as 'none' | 'instapay' | 'percent_caps' | 'fixed';
                updateFeeSettings({
                  defaultRule: {
                    ...feeCfg.defaultRule,
                    enabled: mode !== 'none',
                    ruleType: mode,
                  },
                });
              }}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-750 text-xs font-semibold text-white outline-none cursor-pointer focus:border-amber-500"
            >
              <option value="none">{t('ruleModeNone')}</option>
              <option value="instapay">{t('ruleModeInstaPay')}</option>
              <option value="percent_caps">{t('ruleModePercentCaps')}</option>
              <option value="fixed">{t('ruleModeFixed')}</option>
            </select>

            {feeCfg.defaultRule.enabled && feeCfg.defaultRule.ruleType === 'percent_caps' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <label className="block text-[11px] text-zinc-300 font-medium">
                    {t('feeRatePercentLabel')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={feeCfg.defaultRule.ratePercent}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updateFeeSettings({
                          defaultRule: {
                            ...feeCfg.defaultRule,
                            ratePercent: Number.isFinite(val) && val >= 0 ? val : 0,
                          },
                        });
                      }}
                      className="w-full min-h-[40px] px-3 py-1.5 pe-8 rounded-lg bg-zinc-900 border border-zinc-750 text-xs font-mono text-white outline-none focus:border-amber-500"
                    />
                    <span className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-zinc-400 pointer-events-none">
                      %
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <label className="block text-[11px] text-zinc-300 font-medium">
                    {t('feeMinCapLabel')}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={feeCfg.defaultRule.minCap}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateFeeSettings({
                        defaultRule: {
                          ...feeCfg.defaultRule,
                          minCap: Number.isFinite(val) && val >= 0 ? val : 0,
                        },
                      });
                    }}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-750 text-xs font-mono text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <label className="block text-[11px] text-zinc-300 font-medium">
                    {t('feeMaxCapLabel')}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={feeCfg.defaultRule.maxCap}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateFeeSettings({
                        defaultRule: {
                          ...feeCfg.defaultRule,
                          maxCap: Number.isFinite(val) && val >= 0 ? val : 0,
                        },
                      });
                    }}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-750 text-xs font-mono text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {feeCfg.defaultRule.enabled && feeCfg.defaultRule.ruleType === 'fixed' && (
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 pt-2">
                <label className="block text-xs text-zinc-300 font-medium">
                  {t('fixedFeeAmountLabel')}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={feeCfg.defaultRule.fixedAmount}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateFeeSettings({
                      defaultRule: {
                        ...feeCfg.defaultRule,
                        fixedAmount: Number.isFinite(val) && val >= 0 ? val : 0,
                      },
                    });
                  }}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-750 text-xs font-mono text-white outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>

          {/* Section 3: Accounting & Linked Lifecycle Explanation */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-2 text-xs text-zinc-300 leading-relaxed">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <Info className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{isArabic ? 'كيفية احتساب وتسجيل رسوم التحويل' : 'Transfer Fee & Commission Accounting'}</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {isArabic
                ? 'عند تحويل مبلغ X مع رسوم F من الحساب (أ) إلى الحساب (ب): يُخصم X + F من الحساب (أ)، ويستلم الحساب (ب) المبلغ X بالكامل، ويُسجَّل الرسم F كمعاملة عمولة بنكية مرتبطة. عند تعديل التحويل أو حذفه، يتم تحديث أو حذف سجل الرسوم تلقائياً.'
                : 'When transferring amount X with fee F from Account A to Account B: Account A is deducted X + F, Account B receives X, and fee F is recorded as a linked bank fee transaction. Any subsequent edit or deletion of the transfer automatically updates or removes the fee record.'}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-98 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-amber-950/30 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{isArabic ? 'حفظ وإغلاق' : 'Done'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
