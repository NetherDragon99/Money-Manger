export interface CurrencyOption {
  code: string;
  name: { en: string; ar: string };
  symbol: string;
}

export const WORLD_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', name: { en: 'US Dollar', ar: 'دولار أمريكي' }, symbol: '$' },
  { code: 'EUR', name: { en: 'Euro', ar: 'يورو' }, symbol: '€' },
  { code: 'GBP', name: { en: 'British Pound', ar: 'جنيه إسترليني' }, symbol: '£' },
  { code: 'EGP', name: { en: 'Egyptian Pound', ar: 'جنيه مصري' }, symbol: 'ج.م' },
  { code: 'SAR', name: { en: 'Saudi Riyal', ar: 'ريال سعودي' }, symbol: 'ر.س' },
  { code: 'AED', name: { en: 'UAE Dirham', ar: 'درهم إماراتي' }, symbol: 'د.إ' },
  { code: 'KWD', name: { en: 'Kuwaiti Dinar', ar: 'دينار كويتي' }, symbol: 'د.ك' },
  { code: 'QAR', name: { en: 'Qatari Riyal', ar: 'ريال قطري' }, symbol: 'ر.ق' },
  { code: 'BHD', name: { en: 'Bahraini Dinar', ar: 'دينار بحريني' }, symbol: 'د.ب' },
  { code: 'OMR', name: { en: 'Omani Rial', ar: 'ريال عماني' }, symbol: 'ر.ع' },
  { code: 'JOD', name: { en: 'Jordanian Dinar', ar: 'دينار أردني' }, symbol: 'د.أ' },
  { code: 'CAD', name: { en: 'Canadian Dollar', ar: 'دولار كندي' }, symbol: 'CA$' },
  { code: 'AUD', name: { en: 'Australian Dollar', ar: 'دولار أسترالي' }, symbol: 'AU$' },
  { code: 'JPY', name: { en: 'Japanese Yen', ar: 'ين ياباني' }, symbol: '¥' },
  { code: 'CNY', name: { en: 'Chinese Yuan', ar: 'يوان صيني' }, symbol: '¥' },
  { code: 'CHF', name: { en: 'Swiss Franc', ar: 'فرنك سويسري' }, symbol: 'CHF' },
  { code: 'TRY', name: { en: 'Turkish Lira', ar: 'ليرة تركية' }, symbol: '₺' },
  { code: 'INR', name: { en: 'Indian Rupee', ar: 'روبية هندية' }, symbol: '₹' },
  { code: 'BRL', name: { en: 'Brazilian Real', ar: 'ريال برازيلي' }, symbol: 'R$' },
  { code: 'MAD', name: { en: 'Moroccan Dirham', ar: 'درهم مغربي' }, symbol: 'د.م.' },
  { code: 'DZD', name: { en: 'Algerian Dinar', ar: 'دينار جزائري' }, symbol: 'د.ج' },
  { code: 'TND', name: { en: 'Tunisian Dinar', ar: 'دينار تونسي' }, symbol: 'د.ت' },
  { code: 'ZAR', name: { en: 'South African Rand', ar: 'راند جنوب أفريقي' }, symbol: 'R' },
];
