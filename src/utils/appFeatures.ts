/**
 * Complete directory of App Features and Version Changelog.
 * Updated on every release with the newest update at the very top.
 */

export interface ReleaseNote {
  version: string;
  releaseDate: string;
  title: { en: string; ar: string };
  highlights: { en: string[]; ar: string[] };
}

export interface FeatureItem {
  id: string;
  icon: string;
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  category: 'core' | 'finance' | 'pwa' | 'customization';
}

export const APP_RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.0.9',
    releaseDate: 'October 16, 2026',
    title: {
      en: 'Visual Date Pickers for Custom Ranges & System-Wide Polish',
      ar: 'تقويم مرئي لكافة النطاقات المخصصة وتحسينات شاملة',
    },
    highlights: {
      en: [
        'Universal Visual Mini Calendar: Custom range selectors in Home, Account details, and Reset Period counter now feature visual calendar and clock menus.',
        'Complete Localization: Added missing week filter translations across English and Arabic.',
        'Seamless Update Sync: Version automatically bumped to 1.0.9 across offline packages, backups, and live updater.',
        'Fluid Spring Animations & Tactile Press: Polished micro-interactions on all modal popups and buttons.',
      ],
      ar: [
        'تقويم مرئي شامل: اختيار التواريخ المخصصة في الرئيسية، تفاصيل الحساب، وإعادة ضبط الدورة أصبح عبر تقويم وقائمة مرئية.',
        'تعريب وترجمة متكاملة: اكتمال ترجمة مرشحات الفترات للأسبوع الماضي باللغتين العربية والإنجليزية.',
        'مزامنة التحديثات: ترقية رقم الإصدار إلى 1.0.9 في الحزم دون اتصال والنسخ الاحتياطية والفاحص المباشر.',
        'حركات سلسة واستجابة لمسية: تفاعل نابض أنيق لكافة النوافذ المنبثقة والأزرار في التطبيق.',
      ],
    },
  },
  {
    version: '1.0.8',
    releaseDate: 'October 16, 2026',
    title: {
      en: 'Visual Pickers, Profile Photo Upload, App Month, & UI Polish',
      ar: 'محددات بصرية، رفع صورة الملف الشخصي، شهر التطبيق، وتحسينات الواجهة',
    },
    highlights: {
      en: [
        'Interactive Mini Calendar & Visual Clock: Tap any date or time to pick from visual menus instead of typing numbers.',
        'Ergonomic Numpad: Redesigned keypad with uniform 3-column layout eliminating the oversized zero (0) button.',
        'Smart Zero-Handling: Entering numbers automatically replaces initial zeros and restores "0" on empty delete.',
        'Custom Profile Photo Upload & Editor: Upload your own photo with circular crop, zoom, or pick from curated default avatars.',
        'Official "App Month" Designation: Explicitly tracks your custom starting-day billing cycle separately from calendar months.',
        'Streamlined Category Header: Cleaned top header in Budget view with balanced action banners in both Expense and Income tabs.',
        'Smooth Motion & Tactile Feedback: Fluid cubic-bezier modal transitions and responsive haptic press feedback.',
        'What\'s New Announcement: First-launch update popup showing release highlights once per version.',
      ],
      ar: [
        'تقويم وساعة مصغرة تفاعلية: النقر على التاريخ أو الوقت يفتح تقويماً مرئياً وقائمة ساعات بدلاً من الكتابة اليدوية.',
        'لوحة أرقام متناسقة: تصميم مريح بثلاثة أعمدة ينهي مشكلة زر الصفر العريض جداً.',
        'معالجة ذكية للأصفار: الكتابة في الحقول الرقمية تزيل الصفر تلقائياً وتعيده عند حذف الرقم كاملاً.',
        'رفع وتعديل صورة الملف الشخصي: رفع صورة خاصة مع قص دائري أو اختيار صورة من المعرض الافتراضي الأنيق.',
        'تسمية رسمية "شهر التطبيق": تمييز دورة الحسابات المخصصة عن الشهر الميلادي العادي بوضوح.',
        'واجهة فئات مبسطة: إزالة الزر المكرر من رأس الصفحة مع بطاقات متوازنة لكل من المصروفات والإيرادات.',
        'حركات سلسة واستجابة لمسية: انتقال انسيابي للنوافذ وتأثيرات ضغط سريعة لكافة الأزرار.',
        'نافذة "ما الجديد": نافذة منبثقة تظهر مرة واحدة فقط بعد كل تحديث لشرح الميزات الجديدة.',
      ],
    },
  },
  {
    version: '1.0.7',
    releaseDate: 'October 16, 2026',
    title: {
      en: 'Expense Summary Banner & Language Sync',
      ar: 'بطاقة ملخص المصروفات ومزامنة اللغة',
    },
    highlights: {
      en: [
        'Matching cycle total banner with "+ Add Expense Category" button in Expense Categories.',
        'Strict language synchronization removing mixed bilingual labels in category modal.',
      ],
      ar: [
        'بطاقة مطابقة لإجمالي مصروفات الدورة مع زر إضافة فئة مصروفات.',
        'مزامنة تامة للغة وإزالة النصوص المختلطة في نافذة الفئات.',
      ],
    },
  },
  {
    version: '1.0.6',
    releaseDate: 'October 16, 2026',
    title: {
      en: 'Income Categories Tab, In-Modal Delete, & GitHub Auto-Updater',
      ar: 'تبويب فئات الإيرادات، حذف بدون تجميد، وتحديث تلقائي من GitHub',
    },
    highlights: {
      en: [
        'Dedicated Income Categories tab in BudgetView so incoming categories are never hidden.',
        'In-modal reliable delete confirmation banner replacing blocked browser confirm dialogs.',
        'Automatic live GitHub update checker on every app launch and resume.',
        'Fullscreen standalone WebAPK configuration without browser URL search bar.',
      ],
      ar: [
        'تبويب مخصص للفئات الواردة في الميزانية لتبقى ظاهرة دائماً.',
        'تأكيد حذف داخلي موثوق يحل مشكلة توقف الحذف بالمتصفح.',
        'فاحص تحديثات تلقائي يفحص GitHub عند فتح التطبيق.',
        'تثبيت كتطبيق مستقل بالكامل على الشاشة الرئيسية بدون شريط متصفح.',
      ],
    },
  },
  {
    version: '1.0.5',
    releaseDate: 'October 15, 2026',
    title: {
      en: 'Live Version Infrastructure',
      ar: 'بنية تتبع الإصدارات الحية',
    },
    highlights: {
      en: ['Live version.json integration and patch increment policy.'],
      ar: ['تكامل ملف الإصدار المباشر وسياسة التحديث التراكمي.'],
    },
  },
  {
    version: '1.0.4',
    releaseDate: 'October 15, 2026',
    title: {
      en: 'Permanent IndexedDB Storage & Direct Download',
      ar: 'تخزين دائم بـ IndexedDB وتنزيل مباشر',
    },
    highlights: {
      en: [
        'Dual-layer persistence engine using IndexedDB and localStorage with persistent storage permission.',
        'Direct application package download with zero instructional modals.',
        'Pure white light mode contrast fixes.',
      ],
      ar: [
        'محرك تخزين ثنائي دائم بـ IndexedDB و localStorage محمي من الحذف.',
        'تنزيل مباشر لحزمة التطبيق بدون نوافذ إرشادية.',
        'تصحيح تباين الوضع الفاتح ليصبح أبيض ناصعاً.',
      ],
    },
  },
];

export const APP_CORE_FEATURES: FeatureItem[] = [
  {
    id: 'accounts',
    icon: '💳',
    category: 'finance',
    title: { en: 'Multi-Account & Net Worth', ar: 'حسابات متعددة وصافي الثروة' },
    description: {
      en: 'Manage Bank accounts, Cash, Wallets, and Savings with public/private visibility and global net worth aggregation.',
      ar: 'إدارة الحسابات البنكية، النقدية، المحافظ، والمدخرات مع خيار الحسابات العامة أو الخاصة وحساب صافي الثروة.',
    },
  },
  {
    id: 'running-balance',
    icon: '📈',
    category: 'finance',
    title: { en: 'Running Account Balances', ar: 'الرصيد التراكمي المستمر' },
    description: {
      en: 'Every transaction records the exact running balance before and after, providing full audit visibility.',
      ar: 'تسجيل دقيق للرصيد قبل وبعد كل معاملة لمعرفة تفاصيل حركة أموالك بدقة متناهية.',
    },
  },
  {
    id: 'app-month',
    icon: '📅',
    category: 'finance',
    title: { en: 'App Month Custom Cycles', ar: 'شهر التطبيق (الدورات المخصصة)' },
    description: {
      en: 'Configure cycles starting on any day of the month (e.g., 25th for payday) with instant period reset controls.',
      ar: 'تحديد يوم مخصص لبداية الشهر المالي (مثل يوم 25 مع الراتب) مع إمكانية تصفير العداد من أي لحظة.',
    },
  },
  {
    id: 'budget-categories',
    icon: '🎯',
    category: 'finance',
    title: { en: 'Expense & Income Budgets', ar: 'ميزانيات المصروفات والإيرادات' },
    description: {
      en: 'Set monthly limits for expense categories with visual progress meters and track incoming income streams.',
      ar: 'تحديد حدود شهرية لفئات الإنفاق مع أشرطة تقدم مرئية وتتبع تدفقات الدخل الواردة.',
    },
  },
  {
    id: 'offline-indexeddb',
    icon: '⚡',
    category: 'core',
    title: { en: '100% Offline & IndexedDB', ar: 'عمل كامل بدون إنترنت وتخزين دائم' },
    description: {
      en: 'Works anywhere with zero internet connection. Data is saved permanently to IndexedDB with persistent storage.',
      ar: 'يعمل في أي مكان بدون اتصال بالإنترنت مع حفظ دائم في قاعدة بيانات IndexedDB المحلية.',
    },
  },
  {
    id: 'standalone-pwa',
    icon: '📱',
    category: 'pwa',
    title: { en: 'Pure Standalone Home Screen App', ar: 'تطبيق مستقل بدون شريط متصفح' },
    description: {
      en: 'Installs as a native-feel WebAPK on your phone home screen with no search bar, URL bar, or browser header.',
      ar: 'تثبيت كتطبيق مستقل على الشاشة الرئيسية يعمل بملء الشاشة بدون شريط عناوين أو رأس للمتصفح.',
    },
  },
  {
    id: 'github-updater',
    icon: '🔄',
    category: 'core',
    title: { en: 'Live GitHub Auto-Updater', ar: 'تحديث تلقائي من GitHub' },
    description: {
      en: 'Checks GitHub on every open and seamlessly applies new updates so you are always on the newest release.',
      ar: 'فحص دوري لمستودع GitHub عند كل فتح وتطبيق التحديثات تلقائياً لضمان حصولك على أحدث إصدار.',
    },
  },
  {
    id: 'profile-avatars',
    icon: '👤',
    category: 'customization',
    title: { en: 'Custom Photo Upload & Avatars', ar: 'رفع صورة شخصية وصور رمزية' },
    description: {
      en: 'Upload your own profile picture with a circular crop editor or pick from curated 3D-styled avatars.',
      ar: 'رفع صورتك الشخصية وتعديلها بقص دائري أو الاختيار من مكتبة الصور الرمزية المميزة.',
    },
  },
  {
    id: 'visual-pickers',
    icon: '🗓️',
    category: 'core',
    title: { en: 'Mini Calendar & Visual Clock', ar: 'تقويم مصغر وساعة مرئية' },
    description: {
      en: 'Quickly select dates from a monthly calendar grid and pick hours/minutes without typing numbers.',
      ar: 'اختيار التواريخ بضغطة واحدة من شبكة التقويم وتحديد الوقت دون الحاجة لكتابة الأرقام يدوياً.',
    },
  },
  {
    id: 'smart-inputs',
    icon: '⌨️',
    category: 'core',
    title: { en: 'Ergonomic Numpad & Smart Zeros', ar: 'لوحة أرقام ذكية وحذف الصفر التلقائي' },
    description: {
      en: 'Clean 3-column numpad with automatic removal of leading zeros and restoration upon deleting.',
      ar: 'لوحة أرقام متوازنة بثلاثة أعمدة مع حذف الصفر التلقائي عند بدء الكتابة وإرجاعه عند المسح.',
    },
  },
  {
    id: 'backup-export',
    icon: '💾',
    category: 'core',
    title: { en: 'JSON Backup & Restore', ar: 'نسخ احتياطي واستعادة بضغطة واحدة' },
    description: {
      en: 'Export your complete finance records to standard JSON or import backups on any device instantly.',
      ar: 'تصدير كافة سجلاتك المالية إلى ملف JSON واستعادتها في أي جهاز بلمح البصر.',
    },
  },
];
