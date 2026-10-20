export interface CurrencyOption {
  code: string;
  name: { en: string; ar: string };
  symbol: string;
  symbolAr?: string;
}

export const WORLD_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', name: { en: 'US Dollar', ar: 'دولار أمريكي' }, symbol: '$', symbolAr: '$' },
  { code: 'EUR', name: { en: 'Euro', ar: 'يورو' }, symbol: '€', symbolAr: '€' },
  { code: 'GBP', name: { en: 'British Pound', ar: 'جنيه إسترليني' }, symbol: '£', symbolAr: '£' },
  { code: 'EGP', name: { en: 'Egyptian Pound', ar: 'جنيه مصري' }, symbol: 'EGP', symbolAr: 'ج.م' },
  { code: 'SAR', name: { en: 'Saudi Riyal', ar: 'ريال سعودي' }, symbol: 'SAR', symbolAr: 'ر.س' },
  { code: 'AED', name: { en: 'UAE Dirham', ar: 'درهم إماراتي' }, symbol: 'AED', symbolAr: 'د.إ' },
  { code: 'KWD', name: { en: 'Kuwaiti Dinar', ar: 'دينار كويتي' }, symbol: 'KWD', symbolAr: 'د.ك' },
  { code: 'QAR', name: { en: 'Qatari Riyal', ar: 'ريال قطري' }, symbol: 'QAR', symbolAr: 'ر.ق' },
  { code: 'BHD', name: { en: 'Bahraini Dinar', ar: 'دينار بحريني' }, symbol: 'BHD', symbolAr: 'د.ب' },
  { code: 'OMR', name: { en: 'Omani Rial', ar: 'ريال عماني' }, symbol: 'OMR', symbolAr: 'ر.ع' },
  { code: 'JOD', name: { en: 'Jordanian Dinar', ar: 'دينار أردني' }, symbol: 'JOD', symbolAr: 'د.أ' },
  { code: 'CAD', name: { en: 'Canadian Dollar', ar: 'دولار كندي' }, symbol: 'CA$', symbolAr: 'CA$' },
  { code: 'AUD', name: { en: 'Australian Dollar', ar: 'دولار أسترالي' }, symbol: 'AU$', symbolAr: 'AU$' },
  { code: 'JPY', name: { en: 'Japanese Yen', ar: 'ين ياباني' }, symbol: '¥', symbolAr: '¥' },
  { code: 'CNY', name: { en: 'Chinese Yuan', ar: 'يوان صيني' }, symbol: '¥', symbolAr: '¥' },
  { code: 'CHF', name: { en: 'Swiss Franc', ar: 'فرنك سويسري' }, symbol: 'CHF', symbolAr: 'CHF' },
  { code: 'TRY', name: { en: 'Turkish Lira', ar: 'ليرة تركية' }, symbol: '₺', symbolAr: '₺' },
  { code: 'INR', name: { en: 'Indian Rupee', ar: 'روبية هندية' }, symbol: '₹', symbolAr: '₹' },
  { code: 'BRL', name: { en: 'Brazilian Real', ar: 'ريال برازيلي' }, symbol: 'R$', symbolAr: 'R$' },
  { code: 'MAD', name: { en: 'Moroccan Dirham', ar: 'درهم مغربي' }, symbol: 'MAD', symbolAr: 'د.م.' },
  { code: 'DZD', name: { en: 'Algerian Dinar', ar: 'دينار جزائري' }, symbol: 'DZD', symbolAr: 'د.ج' },
  { code: 'TND', name: { en: 'Tunisian Dinar', ar: 'دينار تونسي' }, symbol: 'TND', symbolAr: 'د.ت' },
  { code: 'ZAR', name: { en: 'South African Rand', ar: 'راند جنوب أفريقي' }, symbol: 'R', symbolAr: 'R' },
];

/**
 * Returns language-aware currency symbol based on user's active language
 */
export function getLocalizedCurrencySymbol(symbolOrCode: string, language: 'en' | 'ar' = 'en'): string {
  if (!symbolOrCode) return language === 'ar' ? 'ج.م' : '£';

  // Check matching currency option
  const match = WORLD_CURRENCIES.find(
    (c) =>
      c.code.toLowerCase() === symbolOrCode.toLowerCase() ||
      c.symbol.toLowerCase() === symbolOrCode.toLowerCase() ||
      (c.symbolAr && c.symbolAr.toLowerCase() === symbolOrCode.toLowerCase())
  );

  if (match) {
    if (language === 'ar') {
      return match.symbolAr || match.symbol;
    }
    return match.symbol;
  }

  // Fallback map for common Arabic currency representations if stored directly
  const arToEnMap: Record<string, string> = {
    'ج.م': 'EGP',
    'ر.س': 'SAR',
    'د.إ': 'AED',
    'د.ك': 'KWD',
    'ر.ق': 'QAR',
    'د.ب': 'BHD',
    'ر.ع': 'OMR',
    'د.أ': 'JOD',
    'د.م.': 'MAD',
    'د.ج': 'DZD',
    'د.ت': 'TND',
  };

  const enToArMap: Record<string, string> = {
    'EGP': 'ج.م',
    'SAR': 'ر.س',
    'AED': 'د.إ',
    'KWD': 'د.ك',
    'QAR': 'ر.ق',
    'BHD': 'د.ب',
    'OMR': 'ر.ع',
    'JOD': 'د.أ',
    'MAD': 'د.م.',
    'DZD': 'د.ج',
    'TND': 'د.ت',
  };

  if (language === 'en' && arToEnMap[symbolOrCode]) {
    return arToEnMap[symbolOrCode];
  }
  if (language === 'ar' && enToArMap[symbolOrCode]) {
    return enToArMap[symbolOrCode];
  }

  return symbolOrCode;
}
