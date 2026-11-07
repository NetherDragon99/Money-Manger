import React from 'react';
import { Coins, Zap, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ManualFeeInputType, TaxFeeMode, TransferFeeSettings } from '../types';

export interface AdvancedTaxFeeInputProps {
  type: 'expense' | 'income' | 'transfer';
  mode: TaxFeeMode;
  onModeChange: (mode: TaxFeeMode) => void;
  inputType: ManualFeeInputType;
  onInputTypeChange: (inputType: ManualFeeInputType) => void;
  inputValue: string;
  calculatedAmount: number;
  baseAmount: number;
  currencySymbol: string;
  isKeypadActive: boolean;
  onFocusKeypad: () => void;
  onBlurKeypad?: () => void;
  feeConfig?: TransferFeeSettings;
  availableBalance?: number;
  exceedsAvailable?: boolean;
  budgetPoolSlot?: React.ReactNode;
  isArabic: boolean;
  t: (key: any) => string;
  formatCurrency: (amount: number, symbol?: string) => string;
  formatDisplayNumber: (val: string) => string;
}

export const AdvancedTaxFeeInput: React.FC<AdvancedTaxFeeInputProps> = ({
  type,
  mode,
  onModeChange,
  inputType,
  onInputTypeChange,
  inputValue,
  calculatedAmount,
  baseAmount,
  currencySymbol,
  isKeypadActive,
  onFocusKeypad,
  onBlurKeypad,
  feeConfig,
  availableBalance = 0,
  exceedsAvailable = false,
  budgetPoolSlot,
  isArabic,
  t,
  formatCurrency,
  formatDisplayNumber,
}) => {
  const isTransfer = type === 'transfer';
  const hasDefaultRule = isTransfer && Boolean(
    feeConfig?.defaultRule?.enabled && feeConfig.defaultRule.ruleType !== 'none',
  );

  return (
    <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2.5">
      {/* Title & Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span>{isTransfer ? t('transferFeeSectionTitle') : t('taxExtraFeeLabel')}</span>
        </span>
        {calculatedAmount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-[11px] font-bold text-amber-300 font-mono">
            +{formatCurrency(calculatedAmount, currencySymbol)}
          </span>
        )}
      </div>

      {!isTransfer && (
        <p className="text-[10px] text-zinc-400 leading-normal">
          {t('taxExtraFeeDesc')}
        </p>
      )}

      {/* Preset / Mode Selector Pills */}
      <div
        className={`grid gap-1.5 ${
          hasDefaultRule ? 'grid-cols-4' : 'grid-cols-3'
        }`}
      >
        {/* Pill 1: None / No Tax */}
        <button
          type="button"
          onClick={() => {
            onModeChange('none');
            if (onBlurKeypad) onBlurKeypad();
          }}
          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer truncate ${
            mode === 'none'
              ? 'bg-zinc-800 border-zinc-600 text-white shadow'
              : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {isTransfer ? t('feeModeNone') : (t('feeModeNoTax') || t('feeModeNone'))}
        </button>

        {/* Pill 2: InstaPay (for Transfer) or VAT 14% (for Expense/Income) */}
        {isTransfer ? (
          <button
            type="button"
            onClick={() => {
              onModeChange('instapay');
              if (onBlurKeypad) onBlurKeypad();
            }}
            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer flex items-center justify-center gap-1 truncate ${
              mode === 'instapay'
                ? 'bg-purple-600/25 border-purple-500/60 text-purple-200 shadow'
                : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3 h-3 text-purple-400 shrink-0" />
            <span className="truncate">{t('feeModeInstaPay')}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onModeChange('vat14');
              if (onBlurKeypad) onBlurKeypad();
            }}
            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer flex items-center justify-center gap-1 truncate ${
              mode === 'vat14'
                ? 'bg-emerald-600/25 border-emerald-500/60 text-emerald-200 shadow'
                : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">{t('feeModeVat14') || 'VAT (14%)'}</span>
          </button>
        )}

        {/* Pill 3: Manual */}
        <button
          type="button"
          onClick={() => {
            onModeChange('manual');
            onFocusKeypad();
          }}
          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer truncate ${
            mode === 'manual'
              ? 'bg-amber-600/25 border-amber-500/60 text-amber-200 shadow'
              : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {t('feeModeManual')}
        </button>

        {/* Pill 4: Optional Default Rule */}
        {hasDefaultRule && (
          <button
            type="button"
            onClick={() => {
              onModeChange('default_rule');
              if (onBlurKeypad) onBlurKeypad();
            }}
            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer flex items-center justify-center gap-1 truncate ${
              mode === 'default_rule'
                ? 'bg-blue-600/25 border-blue-500/60 text-blue-200 shadow'
                : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldCheck className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="truncate">{t('feeModeDefaultRule')}</span>
          </button>
        )}
      </div>

      {/* Preset summaries */}
      {mode === 'instapay' && feeConfig && (
        <div className="px-3 py-2 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between text-xs">
          <span className="text-[10px] text-purple-300">
            {t('instaPayPresetSummary')
              .replace('{rate}', String(feeConfig.instaPayPreset.ratePercent))
              .replace('{min}', formatCurrency(feeConfig.instaPayPreset.minFee, currencySymbol))
              .replace('{max}', formatCurrency(feeConfig.instaPayPreset.maxFee, currencySymbol))}
          </span>
          <span className="font-mono font-bold text-purple-200">
            {formatCurrency(calculatedAmount, currencySymbol)}
          </span>
        </div>
      )}

      {mode === 'vat14' && (
        <div className="px-3 py-2 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-xs">
          <span className="text-[10px] text-emerald-300">
            {isArabic ? 'ضريبة القيمة المضافة القياسية (14%)' : 'Standard Value Added Tax (14%)'}
          </span>
          <span className="font-mono font-bold text-emerald-200">
            {formatCurrency(calculatedAmount, currencySymbol)}
          </span>
        </div>
      )}

      {mode === 'default_rule' && (
        <div className="px-3 py-2 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center justify-between text-xs">
          <span className="text-[10px] text-blue-300">
            {isArabic ? 'قاعدة الرسوم والضرائب الافتراضية' : 'Default Tax / Fee Rule'}
          </span>
          <span className="font-mono font-bold text-blue-200">
            {formatCurrency(calculatedAmount, currencySymbol)}
          </span>
        </div>
      )}

      {/* Manual Input with [ Currency | % ] Toggle & In-App Keypad Binding */}
      {mode === 'manual' && (
        <div className="space-y-2 pt-1 border-t border-zinc-800/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-300">
              {isTransfer
                ? t('manualFeeInputLabel')
                : (t('manualTaxInputLabel') || t('manualFeeInputLabel'))}
            </span>

            {/* Toggle Currency vs Percent */}
            <div className="inline-flex rounded-lg bg-zinc-950 p-0.5 border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  onInputTypeChange('amount');
                  onFocusKeypad();
                }}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                  inputType === 'amount'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {currencySymbol}
              </button>
              <button
                type="button"
                onClick={() => {
                  onInputTypeChange('percent');
                  onFocusKeypad();
                }}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                  inputType === 'percent'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                %
              </button>
            </div>
          </div>

          {/* Interactive display button that hooks to in-app keypad (NO native OS keyboard) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onFocusKeypad}
              className={`px-3 py-2 rounded-xl font-mono text-left rtl:text-right flex items-center justify-between transition cursor-pointer text-sm font-bold ${
                isKeypadActive
                  ? 'bg-amber-500/15 border-2 border-amber-500/80 text-amber-200 ring-2 ring-amber-500/30'
                  : 'bg-zinc-950 border border-zinc-800 text-white hover:border-zinc-700'
              }`}
            >
              <span className="text-xs text-amber-400">
                {inputType === 'percent' ? '%' : currencySymbol}
              </span>
              <span className="truncate">{formatDisplayNumber(inputValue || '0')}</span>
            </button>

            <div className="px-3 py-2 rounded-xl bg-zinc-950/90 border border-zinc-800/80 flex items-center justify-between text-xs">
              <span className="text-[10px] text-zinc-400 truncate">
                {isTransfer
                  ? t('calculatedFeeLabel')
                  : (t('calculatedTaxLabel') || t('calculatedFeeLabel'))}
              </span>
              <span className="font-mono font-bold text-amber-300">
                {formatCurrency(calculatedAmount, currencySymbol)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown when Fee / Tax > 0 */}
      {calculatedAmount > 0 && (
        <div className="pt-2 border-t border-zinc-800/80 space-y-2">
          {isTransfer ? (
            <>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">{t('totalDeductedWithFee')}:</span>
                <span className="font-mono font-bold text-red-300">
                  {formatCurrency(baseAmount + calculatedAmount, currencySymbol)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">{t('recipientReceivesLabel')}:</span>
                <span className="font-mono font-bold text-emerald-300">
                  {formatCurrency(baseAmount, currencySymbol)}
                </span>
              </div>

              {exceedsAvailable && (
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center gap-2 text-[11px] text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {t('insufficientBalanceWithFeeWarning')
                      .replace(
                        '{total}',
                        formatCurrency(baseAmount + calculatedAmount, currencySymbol),
                      )
                      .replace(
                        '{balance}',
                        formatCurrency(availableBalance, currencySymbol),
                      )}
                  </span>
                </div>
              )}

              {budgetPoolSlot}
            </>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
              <div className="p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60">
                <div className="text-[9px] text-zinc-400 font-sans truncate">
                  {t('amountBeforeTax')}
                </div>
                <div className="text-xs font-semibold text-zinc-200 mt-0.5 truncate">
                  {formatCurrency(baseAmount, currencySymbol)}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="text-[9px] text-amber-300/80 font-sans truncate">
                  {t('taxAmount')}
                </div>
                <div className="text-xs font-semibold text-amber-300 mt-0.5 truncate">
                  +{formatCurrency(calculatedAmount, currencySymbol)}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div className="text-[9px] text-emerald-300/80 font-sans truncate">
                  {t('totalAfterTax')}
                </div>
                <div className="text-xs font-bold text-emerald-300 mt-0.5 truncate">
                  {formatCurrency(baseAmount + calculatedAmount, currencySymbol)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
