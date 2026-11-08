import { FeatureItem, ReleaseNote } from '../types';
import { IS_BETA_BUILD } from './channel';

export type { FeatureItem, ReleaseNote };

/**
 * Returns the release notes visible for the running build channel.
 * Driven ONLY by IS_BETA_BUILD (never by the mm_join_beta flag):
 * - Stable build: official entries only (isBeta !== true) and never entries merged via rolledUpInto.
 * - Beta build: the full chronological timeline.
 */
export function getReleaseNotesForChannel(
  notes: ReleaseNote[] = APP_RELEASE_NOTES,
  isBetaBuild: boolean = IS_BETA_BUILD
): ReleaseNote[] {
  if (isBetaBuild) return notes;
  return notes.filter((n) => n.isBeta !== true && !n.rolledUpInto);
}

export const APP_RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.2.0',
    isBeta: true,
    releaseDate: 'November 8, 2026',
    title: {
      en: 'Smart Budget Overhaul & Absolute EGP Allocations',
      ar: 'تحديث شامل للميزانية الذكية وتوزيع دقيق بالمبالغ النقدية',
    },
    highlights: {
      en: [
        'Absolute EGP allocations: Set exact fixed amounts for Savings, Bills, and Outings without floating-point percentage math overriding your inputs',
        'Deterministic daily remainder: The daily spending pool is strictly calculated as the exact remaining balance of your income after allocations',
        'Accurate daily allowance: Strict, precise division in "From Today" mode gives you the exact remaining daily allowance based on remaining days',
        'Account role presets: Quick-filter presets now strictly distinguish between spending accounts and savings/investment accounts based on schema roles',
      ],
      ar: [
        'توزيع دقيق بالمبالغ النقدية: إدخال مبالغ ثابتة ومحددة بدقة لأحواض الادخار والفواتير والخروجات دون أي تغييرات ناتجة عن النسب المئوية',
        'حوض المصروف اليومي كباقي حتمي: حساب حوض المصروف اليومي كالمتبقي الفعلي والصريح من الدخل بعد استقطاع المبالغ المحددة',
        'حساب دقيق للمصروف اليومي المتبقي: معادلة قسمة دقيقة ومباشرة في وضع "من اليوم" لتحديد المصروف المسموح به لكل يوم متبقٍ في الدورة',
        'فلاتر أدوار الحسابات: تمييز فوري وصارم بين حسابات الصرف وحسابات الادخار والاستثمار بناءً على الأدوار المحددة لكل حساب',
      ],
    },
  },
  {
    version: '1.1.70',
    isBeta: true,
    releaseDate: 'November 7, 2026',
    title: {
      en: 'Complete Offline Reliability, Live Linked Budgeting and Refined Controls',
      ar: 'موثوقية كاملة بدون إنترنت، ربط الحسابات الحية بالميزانية وتحكم أسهل',
    },
    highlights: {
      en: [
        'Guaranteed offline experience: Access all your accounts, records, and tools seamlessly anytime without an internet connection',
        'Live linked accounts: Your monthly budget now updates automatically from your chosen spending accounts as you add expenses and income',
        'Simulate expenses in real time: Preview how a purchase changes your daily spending limit before you spend a single pound',
        'Flexible taxes and transfer fees: Easily add taxes, transfer charges, or percent-based fees with an auto-expanding notes area',
        'Organized settings and transfer rules: Cleaner navigation menus with dedicated settings and transfer commission panels',
        'Full category donut chart: Color-coded spending charts displaying every active category with exact proportions',
      ],
      ar: [
        'استخدام كامل بدون إنترنت: افتح سجلاتك وحساباتك وتصفح جميع أقسام التطبيق بدون الحاجة للاتصال بالشبكة',
        'ربط الحسابات الحية بالميزانية: يتحدث مصروف الشهر تلقائياً من أرصدة حساباتك المحددة مع كل معاملة جديدة',
        'محاكاة المصروفات فورياً: شاهد تأثير أي مشتروات على مصروفك اليومي وميزانيتك قبل أن تدفع أي قرش',
        'حساب مرن للضرائب ورسوم التحويل: إضافة الضرائب أو رسوم التحويل بسهولة بنسبة مئوية أو مبلغ ثابت مع مربع ملاحظات يتسع تلقائياً',
        'قوائم إعدادات منظمة: تنظيم القائمة الجانبية وإضافة شاشات مستقلة لتفضيلات التطبيق وقواعد رسوم التحويل',
        'رسم بياني دائري متكامل: عرض كافة الفئات النشطة بألوان مميزة ونسب دقيقة ومتناسقة',
      ],
    },
  },
  {
    version: '1.1.61',
    isBeta: false,
    releaseDate: 'October 29, 2026',
    title: {
      en: 'Two-Channel Deployment (Stable & Beta), "Join Beta" Opt-In & Channel Switching Safeguards',
      ar: 'نظام القناتين (المستقرة والتجريبية)، خيار الانضمام للبيتا وضمانات تبديل القنوات',
    },
    highlights: {
      en: [
        'Two-Channel Builds: Independent Stable and Beta deployment channels with isolated service workers and cache scopes so experimental builds never disrupt stable users',
        'Join Beta Toggle: Direct opt-in control in Sidebar with dynamic reachability checks and real-time availability status',
        'High-Severity Caution Modal: Comprehensive safety warning with pre-beta IndexedDB safety snapshots and optional JSON backup export before entering the Beta channel',
        'Safe Channel Switching: Bidirectional switching between Stable and Beta with confirmation prompts and smooth base-path transitions',
      ],
      ar: [
        'نظام الإصدار المزدوج: فصل تام بين القناة المستقرة والقناة التجريبية بنطاقات تخزين مؤقت وعمال خدمة مستقلين لمنع أي تعارض',
        'زر الانضمام للبيتا: مفتاح تبديل في القائمة الجانبية مع فحص تلقائي لتوفر النسخة التجريبية وحالتها المباشرة',
        'تحذير عالي الأهمية ونسخ احتياطي: تنبيه أمان شامل مع حفظ تلقائي لقطة أمان في قاعدة البيانات وتنزيل ملف اختياري قبل التبديل للبيتا',
        'تبديل آمن بين القنوات: إمكانية التبديل والعودة بين المستقرة والتجريبية بكل سلاسة مع نوافذ تأكيد وانتقال آمن بين المسارات',
      ],
    },
  },
];

export const APP_CORE_FEATURES: FeatureItem[] = [
  {
    id: 'cloud-sync',
    icon: '☁️',
    category: 'core',
    title: {
      en: 'Live Cloud Backup & Real-Time Sync',
      ar: 'النسخ الاحتياطي والمزامنة السحابية اللحظية',
    },
    subtitle: {
      en: 'Instant multi-device live synchronization',
      ar: 'مزامنة لحظية وتلقائية عبر جميع أجهزتك',
    },
    description: {
      en: 'Keep your financial records safe and automatically synchronized across all your smartphones, tablets, and computers in real time. Whenever you add an expense, transfer funds, or edit a category, your changes save securely to the Firebase cloud engine instantly so your balances always match.',
      ar: 'احتفظ بسجلاتك المالية آمنة ومحدثة تلقائياً عبر جميع هواتفك وأجهزتك اللوحية وحاسوبك في الوقت الفعلي. بمجرد إضافة أي مصروف أو تحويل أو تعديل فئة، تُحفظ بياناتك بأمان في السحابة فوراً لتبقى أرصدتك متطابقة دائماً في كل مكان.',
    },
    whereToFind: {
      en: 'Side Menu (☰) → Tap "Sign In with Google" at the bottom or check the Live Sync Status indicator dot.',
      ar: 'القائمة الجانبية (☰) ← اضغط على "تسجيل الدخول باستخدام جوجل" أسفل القائمة أو راقب مؤشر المزامنة اللحظي.',
    },
    howToUse: {
      en: [
        'Open the side menu by tapping the menu icon (☰) at the top left of the Home screen.',
        'Tap "Sign In with Google" at the bottom of the drawer to link your account securely.',
        'Observe the subtle connection dot in the sidebar displaying "Synced" with your exact last backup timestamp.',
        'Any transactions you record or edit will now automatically back up to the cloud without manual saving.',
      ],
      ar: [
        'افتح القائمة الجانبية بالضغط على زر القائمة (☰) أعلى الشاشة الرئيسية.',
        'اضغط على "تسجيل الدخول باستخدام جوجل" أسفل القائمة لربط حسابك بأمان وسرعة.',
        'لاحظ نقطة الاتصال الأنيقة أسفل القائمة التي توضح حالة "متزامن" مع توقيت آخر حفظ بالدقيقة.',
        'كافة المعاملات والتعديلات التي تجريها ستُحفظ تلقائياً في السحابة فور إدخالها دون الحاجة لأي حفظ يدوي.',
      ],
    },
    proTip: {
      en: 'You can work completely offline! All additions and edits are saved locally and will automatically flush to the cloud the moment your device reconnects to Wi-Fi or cellular data.',
      ar: 'يمكنك استخدام التطبيق بالكامل بدون إنترنت؛ حيث تُحفظ كافة التعديلات في هاتفك وتُرفع تلقائياً للسحابة بمجرد عودة الاتصال.',
    },
  },
  {
    id: 'shared-spaces',
    icon: '👥',
    category: 'finance',
    title: {
      en: 'Shared Spaces & Collaborative Groups',
      ar: 'المساحات المشتركة والميزانية العائلية',
    },
    subtitle: {
      en: 'Real-time joint budgeting with family & friends',
      ar: 'متابعة المصروفات المشتركة مع العائلة والأصدقاء',
    },
    description: {
      en: 'Create private collaborative spaces for families, roommates, travel groups, or joint projects. Everyone invited to a space can log expenses, track shared balances, and import transactions directly into their personal accounts with full privacy control.',
      ar: 'أنشئ مساحات مالية مشتركة خاصة للعائلة أو الشركاء في السكن أو مجموعات السفر والمشاريع المشتركة. يمكن لجميع الأعضاء تسجيل المصروفات، متابعة الرصيد المشترك، واستيراد المعاملات لحساباتهم الشخصية بخصوصية تامة.',
    },
    whereToFind: {
      en: 'Side Menu (☰) → "Shared Spaces Hub", or tap any Shared Space badge on the Home screen ledger.',
      ar: 'القائمة الجانبية (☰) ← "المساحات المشتركة"، أو اضغط على شارة المشاركة في الشاشة الرئيسية.',
    },
    howToUse: {
      en: [
        'Open the side menu and select "Shared Spaces Hub".',
        'Tap "Create New Space", enter a space name, and choose a custom icon.',
        'Invite family or friends by sharing your invite link or entering their 16-digit ID.',
        'Tap into the space to view its real-time ledger, log shared spending, or batch import transactions.',
      ],
      ar: [
        'افتح القائمة الجانبية واختر "المساحات المشتركة".',
        'اضغط على "إنشاء مساحة جديدة"، اكتب اسماً للمساحة واختر أيقونة مناسبة.',
        'قم بدعوة الشركاء بمشاركة رابط الدعوة أو إدخال معرّفهم المكون من 16 رقماً.',
        'اضغط على المساحة لمشاهدة كشف الحساب اللحظي، تسجيل المصروفات المشتركة، أو استيرادها لحسابك الشخصي.',
      ],
    },
    proTip: {
      en: 'Long-press any transaction inside a shared space to enter multi-select, then tap "Import to Account" to replicate them into your personal account in one step.',
      ar: 'اضغط مطولاً على أي معاملة داخل المساحة المشتركة لتحديد عدة معاملات معاً، ثم اضغط "استيراد إلى حسابي" لنسخها دفعة واحدة.',
    },
  },
  {
    id: 'recurring-transactions',
    icon: '🔁',
    category: 'finance',
    title: {
      en: 'Scheduled Recurring Transactions Engine',
      ar: 'محرك المعاملات الدورية المجدولة',
    },
    subtitle: {
      en: 'Automate repeating bills, rent, and salaries',
      ar: 'أتمتة الفواتير والرواتب والإيجارات الدورية',
    },
    description: {
      en: 'Never forget to record regular monthly expenses or income again. Set up automated schedules for salaries, apartment rent, internet bills, subscriptions, or savings contributions. Even if you open the app days later, all missed schedules catch up with their exact dates and times preserved.',
      ar: 'لا داعي للقلق بشأن نسيان تسجيل فواتيرك الدورية أو راتبك الشهري. اضبط مواعيد متكررة لراتبك، إيجار المنزل، اشتراكات الإنترنت، أو المدخرات. حتى وإن فتحت التطبيق بعد أيام، سيتم توثيق كافة المعاملات المستحقة بتواريخها وساعاتها الدقيقة.',
    },
    whereToFind: {
      en: 'Add Transaction (+) → Toggle "Recurring Transaction", or Side Menu (☰) → "Recurring Transactions".',
      ar: 'شاشة الإضافة (+) ← تفعيل مفتاح "معاملة متكررة"، أو القائمة الجانبية (☰) ← "المعاملات المتكررة".',
    },
    howToUse: {
      en: [
        'Tap the bottom "+" button to open the Add Transaction modal.',
        'Turn on the "Recurring Transaction" toggle switch located above the notes area.',
        'Choose your frequency (daily, weekly, monthly, or yearly) and pick the execution time.',
        'Save the transaction. Manage, pause, or edit your rules anytime from the side menu under "Recurring Transactions".',
      ],
      ar: [
        'اضغط على زر "+" في الشريط السفلي لفتح شاشة إضافة معاملة جديدة.',
        'فعّل مفتاح "معاملة متكررة" الموجود مباشرة أعلى خانة الملاحظات.',
        'اختر وتيرة التكرار (يومياً، أسبوعياً، شهرياً، أو سنوياً) وحدد وقت التنفيذ المفضل.',
        'احفظ المعاملة؛ ويمكنك إدارة القواعد وإيقافها مؤقتاً في أي وقت من القائمة الجانبية عبر "المعاملات المتكررة".',
      ],
    },
    proTip: {
      en: 'In the Recurring Transactions manager, long-press any scheduled rule to immediately process and record it ahead of its scheduled date.',
      ar: 'في قائمة المعاملات المتكررة، اضغط مطولاً على أي قاعدة لتنفيذها وتسجيلها في حسابك فوراً قبل موعدها المحدد.',
    },
  },
  {
    id: 'multi-select',
    icon: '☑️',
    category: 'core',
    title: {
      en: 'Multi-Select & Bulk Batch Operations',
      ar: 'التحديد المتعدد والإجراءات الجماعية',
    },
    subtitle: {
      en: 'Batch delete, move, or export transactions',
      ar: 'حذف ونقل وتصدير دفعات من المعاملات',
    },
    description: {
      en: 'Manage your transactions and records faster with powerful bulk selection tools. Select multiple transactions across days, or pick an entire day or month at once, to delete, transfer, or export them in a single tap without tedious repetitive editing.',
      ar: 'أدر معاملاتك وسجلاتك بسرعة وسلاسة مع ميزة التحديد الجماعي. حدد عدة معاملات عبر أيام مختلفة، أو اختر يوماً أو شهراً كاملاً بضغطة واحدة لحذفها أو نقلها أو تصديرها في لحظة دون تكرار الخطوات.',
    },
    whereToFind: {
      en: 'Home Screen → Long-press any transaction card, or tap the checkmark icon (✓) in the top header.',
      ar: 'الشاشة الرئيسية ← اضغط مطولاً على أي بطاقة معاملة، أو اضغط على أيقونة الصح (✓) في الشريط العلوي.',
    },
    howToUse: {
      en: [
        'Press and hold any transaction card on the Home screen to enter Multi-Select mode.',
        'Tap additional transaction cards to select or deselect them dynamically.',
        'Tap any day group header to immediately select all transactions logged on that date.',
        'Use the floating action bar at the bottom to delete or batch process all selected items.',
      ],
      ar: [
        'اضغط مطولاً على أي معاملة في الشاشة الرئيسية للدخول في وضع التحديد المتعدد.',
        'المس أي معاملات إضافية لتحديدها أو إلغاء تحديدها بسلاسة.',
        'المس عنوان أي يوم لتحديد جميع المعاملات المسجلة في ذلك اليوم بلمسة واحدة.',
        'استخدم شريط الإجراءات العائم بالأسفل لحذف أو معالجة جميع العناصر المحددة دفعة واحدة.',
      ],
    },
    proTip: {
      en: 'Tapping the checkmark icon in the top header instantly selects every transaction in the current month for swift batch management.',
      ar: 'الضغط على أيقونة الصح أعلى القائمة يتيح لك تحديد كافة معاملات الشهر الحالي بلمسة واحدة لإدارتها بسرعة فائقة.',
    },
  },
  {
    id: 'swipe-carousel',
    icon: '👆',
    category: 'core',
    title: {
      en: 'Native 120 FPS Gesture Navigation',
      ar: 'التنقل بالسحب وتتبع حركة الأصبع 120 إطاراً',
    },
    subtitle: {
      en: 'Silky smooth horizontal page gliding',
      ar: 'تنقل سريع وانسيابي بالسحب الأفقي',
    },
    description: {
      en: 'Experience natural, physical gesture navigation engineered with native CSS scroll-snap. The app smoothly tracks your finger horizontally as you glide between bottom tabs, expense/income categories, and shared spaces tabs, snapping into place with zero lag.',
      ar: 'استمتع بتنقل طبيعي وانسيابي يعتمد على الإيماءات الحركية ومحرك CSS scroll-snap الطبيعي. تتتبع الشاشات حركة أصبعك أفقياً بدقة أثناء التبديل بين التبويبات السفلية، فئات المصروفات والإيرادات، وقوائم المشاركة لتستقر بسلاسة فائقة بمعدل 120 إطاراً بالثانية.',
    },
    whereToFind: {
      en: 'Any Main Screen → Swipe horizontally left or right anywhere across the page body.',
      ar: 'أي شاشة رئيسية في التطبيق ← اسحب بإصبعك أفقياً يميناً أو يساراً في أي مكان بالصفحة.',
    },
    howToUse: {
      en: [
        'Place your finger anywhere on the screen and swipe horizontally to switch main tabs smoothly.',
        'In the Categories screen, swipe across the page to glide smoothly between Expense and Income views.',
        'In the Shared Spaces Hub, swipe across to move between "My Shares" and "Shared with Me".',
        'On the Home screen, swipe inward from the side edge to pull the navigation drawer open.',
      ],
      ar: [
        'ضع أصبعك على أي مكان في الشاشة واسحب أفقياً يميناً أو يساراً للتبديل بين التبويبات الرئيسية.',
        'في شاشة الفئات، اسحب جانباً للتنقل الفوري بين فئات المصروفات وفئات الإيرادات.',
        'في شاشة المساحات المشتركة، اسحب للتبديل بسهولة بين "مشاركاتي" و"مشارك معي".',
        'في الشاشة الرئيسية، اسحب من حافة الشاشة لسحب القائمة الجانبية وفتحها بسلاسة.',
      ],
    },
    proTip: {
      en: 'The gesture engine intelligently locks horizontal swipes during vertical scrolling, guaranteeing that reading long lists is never accidentally interrupted.',
      ar: 'يقفل محرك الإيماءات التمرير الأفقي تلقائياً أثناء التمرير الرأسي، مما يضمن تصفح القوائم الطويلة دون أي انقطاع بالخطأ.',
    },
  },
  {
    id: 'built-in-calculator',
    icon: '🧮',
    category: 'finance',
    title: {
      en: 'Integrated Financial Keypad & Math Tab',
      ar: 'حاسبة مالية مدمجة ولوحة أرقام ذكية',
    },
    subtitle: {
      en: 'Calculate expressions directly inside transactions',
      ar: 'حساب المعادلات الحسابية مباشرة داخل المعاملة',
    },
    description: {
      en: 'No need to switch between calculator apps and write down numbers on paper. Perform instant additions, subtractions, multiplications, and divisions directly on the transaction keypad, or use the dedicated full-screen Calculator tab in the bottom bar with calculation history.',
      ar: 'لا حاجة للتبديل بين تطبيقات الآلة الحاسبة وكتابة الأرقام يدوياً. قم بعمليات الجمع والطرح والضرب والقسمة مباشرة من لوحة أرقام المعاملة، أو استخدم تبويب الحاسبة المستقل في الشريط السفلي المزود بسجل حسابات متقدم.',
    },
    whereToFind: {
      en: 'Add Transaction (+) Keypad → Math keys (+, −, ×, ÷), or Bottom Navigation Bar → "Calculator" Tab.',
      ar: 'لوحة أرقام المعاملة (+) ← مفاتيح العمليات (+، −، ×، ÷)، أو الشريط السفلي ← تبويب "الحاسبة".',
    },
    howToUse: {
      en: [
        'When entering a transaction amount, tap any math operator (+, −, ×, ÷) right on the numpad.',
        'Type your numbers and tap the "=" key to calculate the final total amount automatically.',
        'For standalone calculations and conversions, tap the "Calculator" tab in the bottom navigation bar.',
      ],
      ar: [
        'أثناء إدخال مبلغ المعاملة، اضغط على أي علامة حسابية (+، −، ×، ÷) مباشرة على لوحة الأرقام.',
        'اكتب الأرقام واضغط على علامة "=" ليتم احتساب الإجمالي تلقائياً في خانة المبلغ.',
        'لإجراء عمليات حسابية مستقلة ومراجعة السجل، اضغط على تبويب "الحاسبة" الموجود في الشريط السفلي.',
      ],
    },
    proTip: {
      en: 'In the Calculator tab, tap any previous calculation in your history ledger to copy its value directly into your active calculations.',
      ar: 'في تبويب الحاسبة، اضغط على أي عملية سابقة من سجل الحسابات لنسخ نتيجتها واستخدامها فوراً في العملية الحالية.',
    },
  },
  {
    id: 'multi-accounts',
    icon: '💳',
    category: 'finance',
    title: {
      en: 'Multiple Accounts & Real-Time Ledgers',
      ar: 'حسابات متعددة وتتبع دقيق للرصيد',
    },
    subtitle: {
      en: 'Separate cash, bank accounts, and wallets',
      ar: 'فصل الأرصدة النقدية والحسابات البنكية والمحافظ',
    },
    description: {
      en: 'Organize your money exactly how it exists in real life. Track your main bank accounts, credit cards, cash wallets, and emergency savings separately. Every transaction records the running balance before and after, making auditing and reconciliation effortless.',
      ar: 'نظّم أموالك كما هي في الواقع تماماً. قسّم ميزانيتك بين حساباتك البنكية، بطاقات الائتمان، المحافظ النقدية، ومدخرات الطوارئ بشكل مستقل. تسجل كل معاملة الرصيد قبل وبعد بدقة لسهولة مراجعة الحسابات وتدقيقها.',
    },
    whereToFind: {
      en: 'Bottom Navigation Bar → "Accounts" Tab, or tap the active account selector on the Home screen.',
      ar: 'الشريط السفلي ← تبويب "الحسابات"، أو اضغط على اسم الحساب المختار في الشاشة الرئيسية.',
    },
    howToUse: {
      en: [
        'Tap the "Accounts" tab in the bottom bar to view your net worth, assets, and individual account cards.',
        'Tap "+ Add Account" to create a new wallet or bank with custom starting balances and icons.',
        'Tap any account card to open its detailed statement and view running balance progression.',
        'Use the Transfer feature to seamlessly move funds between accounts with dual ledger entries.',
      ],
      ar: [
        'اضغط على تبويب "الحسابات" في الشريط السفلي لعرض صافي الثروة وقائمة الحسابات التفصيلية.',
        'اضغط على "+ إضافة حساب" لإنشاء محفظة أو بنك جديد مع تحديد الرصيد الافتتاحي والأيقونة.',
        'اضغط على أي حساب لفتح كشف حسابه الكامل ومعرفة تفاصيل حركة الرصيد مع كل معاملة.',
        'استخدم ميزة التحويل لنقل الأموال بين حساباتك بسلاسة مع توثيق القيد المزدوج تلقائياً.',
      ],
    },
    proTip: {
      en: 'Mark sensitive personal accounts as "Private" in their settings to exclude them from the public net worth total displayed on the Home screen in public environments.',
      ar: 'يمكنك تعيين الحسابات الشخصية كـ "حساب خاص" من إعدادات الحساب لإخفائها من إجمالي الرصيد الظاهر على الشاشة الرئيسية عند التواجد في مكان عام.',
    },
  },
  {
    id: 'custom-cycles',
    icon: '📅',
    category: 'finance',
    title: {
      en: 'Custom Payday Financial Cycles',
      ar: 'دورات الشهر المالي ومطابقة موعد الراتب',
    },
    subtitle: {
      en: 'Align monthly budgets with actual payday',
      ar: 'مزامنة ميزانيتك الشهرية مع موعد نزول الراتب',
    },
    description: {
      en: 'Match your budget with your actual payday instead of rigid calendar months. If your salary arrives on the 25th or 27th, configure your financial cycle to start on that day so your monthly spending resets right when your income arrives.',
      ar: 'طابق ميزانيتك مع موعد استلام راتبك الحقيقي بدلاً من الالتزام ببداية الشهر الميلادي. إذا كان راتبك ينزل يوم 25 أو 27 من كل شهر، اضبط دورتك المالية لتبدأ في ذلك اليوم ليتجدد حساب مصاريفك مع نزول الراتب.',
    },
    whereToFind: {
      en: 'Home Screen → Tap the active financial period badge, or Accounts Tab → Edit Account → "Month Start Day".',
      ar: 'الشاشة الرئيسية ← اضغط على شريط الفترة المالية بالأعلى، أو تبويب الحسابات ← تعديل الحساب ← "يوم بداية الشهر".',
    },
    howToUse: {
      en: [
        'Tap the period header on the Home screen to view your active financial cycle dates.',
        'Choose "Reset Period" to start a fresh tracking cycle immediately or from a past moment.',
        'In Account Settings, set a custom "Start Day of Month" (e.g. 25) to align that account with your salary.',
      ],
      ar: [
        'اضغط على شريط الفترة المالية أعلى الشاشة الرئيسية لعرض تفاصيل دورتك الحالية وتواريخها.',
        'اختر "تصفير العداد" لبدء دورة مالية جديدة ابتداءً من هذه اللحظة أو من تاريخ محدد.',
        'في إعدادات أي حساب، حدد "يوم بداية الشهر المالي" (مثل 25) لربط مصاريف الحساب بموعد الراتب.',
      ],
    },
    proTip: {
      en: 'Resetting the cycle zeroes out your current period spending counter without deleting any of your past transaction records.',
      ar: 'تصفير العداد يقوم بإعادة ضبط عداد المصروفات للفترة الحالية فقط دون حذف أي معاملة سابقة من سجلاتك.',
    },
  },
  {
    id: 'category-budgets',
    icon: '🎯',
    category: 'finance',
    title: {
      en: 'Visual Category Budgets & Limit Alerts',
      ar: 'ميزانيات الإنفاق وتحديد المصروفات للفئات',
    },
    subtitle: {
      en: 'Monthly spending limits with visual progress',
      ar: 'تحديد أسقف إنفاق شهرية مع أشرطة تقدم ملونة',
    },
    description: {
      en: 'Keep your spending disciplined and prevent budget overruns. Assign monthly spending caps to categories like Groceries, Dining Out, Shopping, and Fuel. Visual progress meters display how much you have spent and how much remains with color-coded warnings.',
      ar: 'تحكّم في مصاريفك وتفادَ تجاوز الميزانية. حدد سقف إنفاق شهري لكل فئة مثل البقالة، المطاعم، التسوق، والوقود. توضح أشرطة التقدم الملونة ما صرفته وما تبقى لك بدقة لتنبيهك قبل نفاد الميزانية مع تغير ألوان الشريط حسب نسبة الاستهلاك.',
    },
    whereToFind: {
      en: 'Bottom Navigation Bar → "Budget" Tab → Tap any category card to configure spending limits.',
      ar: 'الشريط السفلي ← تبويب "الميزانية" ← اضغط على أي فئة لضبط أو تعديل الحد الأقصى للإنفاق.',
    },
    howToUse: {
      en: [
        'Tap the "Budget" tab in the bottom navigation bar.',
        'Tap any category card to set or update its monthly spending limit amount.',
        'As you add transactions, the progress bar updates in real time and changes color as you approach your limit.',
        'Review the category budget summary cards at the top of the Budget tab to see total allocated funds.',
      ],
      ar: [
        'اضغط على تبويب "الميزانية" في الشريط السفلي للتطبيق.',
        'المس أي فئة من فئات المصروفات لتحديد الحد الأقصى للإنفاق الشهري لها.',
        'مع كل معاملة تضيفها، يتحدث شريط التقدم فورياً ويتغير لونه لتنبيهك عند الاقتراب من الحد المحدد.',
        'راجع بطاقات ملخص الميزانية أعلى الشاشة لمعرفة إجمالي المبالغ المخصصة ونسبة الالتزام بها.',
      ],
    },
    proTip: {
      en: 'Tap the gear icon on the Budget screen to drag and reorder categories so your most frequent spending appears right at the top.',
      ar: 'اضغط على أيقونة الترتيب في شاشة الميزانية لإعادة ترتيب الفئات بالسحب والإفلات لتظهر فئاتك المفضلة دائماً في المقدمة.',
    },
  },
  {
    id: 'offline-pwa',
    icon: '📱',
    category: 'pwa',
    title: {
      en: '100% Offline PWA & Home Screen WebAPK',
      ar: 'تثبيت كتطبيق مستقل وعمل كامل بدون إنترنت',
    },
    subtitle: {
      en: 'Install directly without app stores',
      ar: 'تثبيت مباشر على الشاشة الرئيسية بدون متجر',
    },
    description: {
      en: 'Install Money Manager directly on your phone home screen as a standalone application. It launches instantly in full screen with no browser address bar or search header, and functions at lightning speed even in airplane mode with complete local caching.',
      ar: 'قم بتثبيت التطبيق مباشرة على شاشة هاتفك الرئيسية ليعمل كتطبيق مستقل بملء الشاشة دون شريط عناوين المتصفح. يفتح التطبيق بسرعة فائقة ويعمل بكفاءة كاملة حتى في وضع الطيران بدون أي اتصال بالإنترنت بفضل التخزين المؤقت الشامل.',
    },
    whereToFind: {
      en: 'Side Menu (☰) → Tap "Install App" button, or browser menu → "Add to Home screen" / "Install".',
      ar: 'القائمة الجانبية (☰) ← اضغط على زر "تثبيت التطبيق"، أو خيارات المتصفح ← "إضافة إلى الشاشة الرئيسية".',
    },
    howToUse: {
      en: [
        'In your mobile browser (Chrome on Android or Safari on iOS), look for the "Install App" prompt.',
        'Alternatively, open the side menu (☰) and tap "Install App" to launch the native installation dialog.',
        'Confirm the installation prompt to add the application icon directly to your Home Screen.',
        'Launch Money Manager from your phone screen to enjoy an immersive, full-screen standalone experience.',
      ],
      ar: [
        'في متصفح هاتفك (كروم على أندرويد أو سفاري على آيفون)، ستظهر رسالة تثبيت التطبيق.',
        'أو افتح القائمة الجانبية (☰) واضغط على "تثبيت التطبيق" لفتح نافذة التثبيت الرسمية فوراً.',
        'وافق على رسالة التثبيت لتظهر أيقونة التطبيق مباشرة على شاشتك الرئيسية كأي تطبيق هاتف.',
        'افتح التطبيق من شاشة هاتفك ليعمل بملء الشاشة بدون شريط المتصفح وبسرعة فائقة.',
      ],
    },
    proTip: {
      en: 'The app is fully cached locally on your device, meaning it boots instantly with zero loading delay even in areas with weak cellular reception.',
      ar: 'يتم حفظ كافة ملفات التطبيق وبياناتك محلياً في هاتفك؛ مما يجعله يفتح في جزء من الثانية حتى في الأماكن ضعيفة التغطية.',
    },
  },
  {
    id: 'security-lock',
    icon: '🔒',
    category: 'core',
    title: {
      en: 'PIN & Biometric Privacy App Lock',
      ar: 'قفل الحماية برمز PIN والبصمة والوجه',
    },
    subtitle: {
      en: 'Secure your financial privacy with biometrics',
      ar: 'حماية خصوصيتك المالية برمز سري وبصمة الإصبع',
    },
    description: {
      en: 'Ensure your financial transactions and personal balances remain strictly confidential. Protect the application with a 4-digit security PIN and fingerprint or Face Unlock authentication whenever the app is reopened or returned from background.',
      ar: 'حافظ على خصوصية سجلاتك المالية وأرصدتك الشخصية بعيداً عن المتطفلين. يمكنك حماية التطبيق برمز مرور سري من 4 أرقام مع دعم بصمة الإصبع وبصمة الوجه عند كل فتح للتطبيق أو العودة إليه من الخلفية.',
    },
    whereToFind: {
      en: 'Side Menu (☰) → Tap "App Lock" (Lock Icon) to activate security and set your 4-digit PIN.',
      ar: 'القائمة الجانبية (☰) ← اضغط على خيار "قفل التطبيق" (أيقونة القفل) لتفعيل الحماية وتعيين الرمز السري.',
    },
    howToUse: {
      en: [
        'Open the side menu and tap the lock icon next to "App Lock".',
        'Enter a secure 4-digit PIN of your choice and confirm it.',
        'Whenever you switch away from the app or reopen it, the security screen prompts for your PIN or fingerprint.',
        'You can disable or change your PIN anytime from the same menu option.',
      ],
      ar: [
        'افتح القائمة الجانبية واضغط على أيقونة القفل بجانب "قفل التطبيق".',
        'اكتب رمز PIN سرياً مكوناً من 4 أرقام وقم بتأكيده.',
        'عند الخروج من التطبيق أو إعادة فتحه، ستظهر شاشة القفل فوراً لطلب الرمز السري أو البصمة.',
        'يمكنك تغيير الرمز أو إلغاء القفل في أي وقت من نفس الخيار في القائمة الجانبية.',
      ],
    },
    proTip: {
      en: 'Biometric unlock automatically activates on supported Android and iOS devices, letting you unlock in a fraction of a second with your fingerprint.',
      ar: 'تُفعل ميزة الفتح بالبصمة تلقائياً على الأجهزة المدعومة لتتمكن من فتح التطبيق في جزء من الثانية بلمسة إصبع واحدة.',
    },
  },
  {
    id: 'backup-restore',
    icon: '💾',
    category: 'core',
    title: {
      en: 'Data Export, JSON Backups & Easy Restore',
      ar: 'تصدير البيانات واستعادتها بسهولة عبر JSON',
    },
    subtitle: {
      en: '100% data ownership with file backups',
      ar: 'ملكية كاملة لبياناتك مع نسخ احتياطي فوري',
    },
    description: {
      en: 'You maintain 100% complete ownership of your financial records. Export your entire transaction history, categories, accounts, and budgets to a standard JSON backup file at any time, or restore your records onto any new phone in seconds with zero data loss.',
      ar: 'أنت تملك بياناتك المالية بالكامل بنسبة 100%. يمكنك تصدير سجلاتك بالكامل إلى ملف نسخ احتياطي قياسي بصيغة JSON في أي وقت، أو استعادة كافة حساباتك ومعاملاتك على هاتف جديد في ثوانٍ معدودة دون فقدان أي بيانات.',
    },
    whereToFind: {
      en: 'Side Menu (☰) → "Backup & Restore" to access download, restore, and cloud backup options.',
      ar: 'القائمة الجانبية (☰) ← "النسخ الاحتياطي والاستعادة" للوصول لخيارات التنزيل والاسترجاع والحفظ.',
    },
    howToUse: {
      en: [
        'Open the side menu and select "Backup & Restore".',
        'Tap "Download Backup" to save a complete JSON copy of your data to your device storage or files app.',
        'To restore on another device, tap "Restore Backup" and select your previously saved JSON file.',
        'Confirm the restore prompt to instantly hydrate all your accounts, transactions, and settings.',
      ],
      ar: [
        'افتح القائمة الجانبية واختر "النسخ الاحتياطي والاستعادة".',
        'اضغط على "تنزيل نسخة احتياطية" لحفظ ملف JSON يحتوي على كامل بياناتك في ذاكرة هاتفك.',
        'لاستعادة بياناتك على جهاز جديد، اضغط على "استعادة نسخة احتياطية" واختر الملف المحفوظ.',
        'أكد عملية الاستعادة ليتم استرجاع كافة الحسابات والمعاملات والإعدادات في لمح البصر.',
      ],
    },
    proTip: {
      en: 'You can link your Google Drive in your User Profile to enable automated weekly or monthly cloud backups behind the scenes.',
      ar: 'يمكنك ربط حساب Google Drive من شاشة الملف الشخصي لتفعيل النسخ الاحتياطي التلقائي أسبوعياً أو شهرياً بدون أي تدخل يدوي.',
    },
  },
  {
    id: 'insights-analytics',
    icon: '📊',
    category: 'finance',
    title: {
      en: 'Visual Financial Insights & Cash Flow Analytics',
      ar: 'تحليلات الإنفاق والرسوم البيانية وتدفق الأموال',
    },
    subtitle: {
      en: 'Interactive charts and category spending trends',
      ar: 'رسوم تفاعلية ومخططات تحليلية للمصروفات',
    },
    description: {
      en: 'Gain deep understanding of where your money goes. The Insights dashboard features interactive visual category pie charts, income versus expense cash flow balances, daily spending distributions, and month-over-month trend comparisons.',
      ar: 'احصل على رؤية عميقة وواضحة لمسار أموالك ومصادر إنفاقك. توفر لك شاشة التحليلات رسوماً بيانية تفاعلية دائرية لتوزيع الفئات، ومقارنة بين الإيرادات والمصروفات، وتدفق السيولة النقدية ومقارنات شهرية دقيقة.',
    },
    whereToFind: {
      en: 'Bottom Navigation Bar → "Insights" Tab, or tap the Insights summary card on the Home screen.',
      ar: 'الشريط السفلي ← تبويب "التحليلات"، أو اضغط على بطاقة ملخص التحليلات في الشاشة الرئيسية.',
    },
    howToUse: {
      en: [
        'Tap the "Insights" tab in the bottom navigation bar.',
        'Tap on any category slice in the pie chart to view its exact total and percentage of total expenses.',
        'Use the month selector at the top to compare historical spending trends between different months.',
        'Scroll down to analyze the daily spending frequency and highest expense days of the month.',
      ],
      ar: [
        'اضغط على تبويب "التحليلات" في الشريط السفلي للتطبيق.',
        'المس أي جزء من الرسم الدائري لمعرفة إجمالي المبلغ المصروف ونسبته المئوية بدقة.',
        'استخدم منتقي الأشهر بالأعلى للمقارنة بين مصاريف الشهر الحالي والأشهر السابقة.',
        'مرر لأسفل لتحليل معدل الإنفاق اليومي ومعرفة الأيام الأكثر استهلاكاً للميزانية.',
      ],
    },
    proTip: {
      en: 'Private accounts are automatically excluded from the Insights totals, giving you clean analytics focused solely on your primary living expenses.',
      ar: 'الحسابات المعينة كـ "حساب خاص" تُستثنى تلقائياً من إحصائيات التحليلات لضمان دقة الرسوم وتركيزها على مصروفاتك الأساسية.',
    },
  },
  {
    id: 'search-filter',
    icon: '🔍',
    category: 'core',
    title: {
      en: 'Universal Transaction Search & Multi-Filters',
      ar: 'البحث الشامل والتصفية المتقدمة للمعاملات',
    },
    subtitle: {
      en: 'Find any transaction by note, category, or amount',
      ar: 'بحث سريع بالوصف أو الفئة أو المبلغ أو الحساب',
    },
    description: {
      en: 'Instantly locate any transaction from months or years ago. The universal search engine scans transaction descriptions, comments, categories, account names, and amounts simultaneously in both Arabic and English with fuzzy matching.',
      ar: 'اعثر على أي معاملة مسجلة في ثوانٍ حتى وإن كانت منذ سنوات. يبحث المحرك الشامل في أوصاف المعاملات، الملاحظات والتعليقات، أسماء الفئات، أسماء الحسابات والمبالغ في آنٍ واحد باللغتين العربية والإنجليزية.',
    },
    whereToFind: {
      en: 'Home Screen / Account Details / Shared Space → Tap the Search Icon (🔍) or Filter Funnel.',
      ar: 'الشاشة الرئيسية / تفاصيل الحساب / المساحات المشتركة ← اضغط على أيقونة البحث (🔍) أو قمع التصفية.',
    },
    howToUse: {
      en: [
        'Tap the Search Icon (🔍) in the top header of the Home screen or inside any account ledger.',
        'Type any keyword, note description, merchant name, or specific amount.',
        'Tap the Filter icon to narrow down transactions by date range, transaction type, or specific accounts.',
        'Tap any matching search result to view or edit its complete transaction details.',
      ],
      ar: [
        'اضغط على أيقونة البحث (🔍) في الشريط العلوي للشاشة الرئيسية أو داخل أي كشف حساب.',
        'اكتب أي كلمة أو وصف أو اسم متجر أو مبلغ تبحث عنه لتظهر النتائج فوراً.',
        'اضغط على أيقونة التصفية لتحديد نطاق زمني معين، أو نوع المعاملة، أو حساب محدد.',
        'المس أي نتيجة من نتائج البحث لعرض كامل تفاصيل المعاملة أو تعديلها.',
      ],
    },
    proTip: {
      en: 'You can type partial numbers (e.g. "50") to quickly filter all transactions matching that specific amount or note.',
      ar: 'يمكنك كتابة جزء من الرقم (مثل "50") لتصفية كافة المعاملات التي يتطابق مبلغها أو رقمها فورياً.',
    },
  },
  {
    id: 'custom-categories',
    icon: '🏷️',
    category: 'customization',
    title: {
      en: 'Custom Categories & Visual Arrangement',
      ar: 'تخصيص الفئات وترتيبها البصري بالسحب',
    },
    subtitle: {
      en: 'Create custom icons and reorder categories',
      ar: 'إنشاء أيقونات مخصصة وترتيب الفئات حسب الأولوية',
    },
    description: {
      en: 'Personalize your financial tracking to match your unique lifestyle. Add custom expense and income categories with rich emojis, custom budget limits, and drag-and-drop custom ordering that syncs across transaction keypads and directory lists.',
      ar: 'خصّص نظام إدارة أموالك ليتماشى مع أسلوب حياتك الفريد. أضف فئات مصروفات وإيرادات مخصصة مع أيقونات إيموجي معبرة، وحدد ميزانيات مستقلة، ورتّب الفئات بالسحب والإفلات لتنعكس تلقائياً في شريط إضافة المعاملات.',
    },
    whereToFind: {
      en: 'Budget Tab → Tap "Categories & Budgets" directory header, or tap "+ Add Category".',
      ar: 'تبويب الميزانية ← اضغط على عنوان دليل "الفئات والميزانيات"، أو اضغط على "+ إضافة فئة".',
    },
    howToUse: {
      en: [
        'Navigate to the Budget tab and tap "+ Add Category" at the top or bottom of the categories list.',
        'Choose whether the category represents Expense or Income, enter a name, and select an emoji icon.',
        'Tap "Save Category" to make it immediately available across all transaction screens.',
        'To reorder, open the Categories directory and drag items to prioritize your most frequent spending.',
      ],
      ar: [
        'انتقل إلى تبويب الميزانية واضغط على "+ إضافة فئة" أعلى أو أسفل قائمة الفئات.',
        'اختر نوع الفئة (مصروف أو دخل)، واكتب اسماً واضحاً، ثم اختر أيقونة إيموجي مناسبة.',
        'اضغط على "حفظ الفئة" لتصبح متاحة فوراً في كافة شاشات إضافة وتسجيل المعاملات.',
        'لإعادة الترتيب، افتح دليل الفئات واسحب الفئات للأعلى لتضع مصروفاتك الأكثر تكراراً في البداية.',
      ],
    },
    proTip: {
      en: 'Your customized category order is automatically respected in the transaction keypad sticky category bar for rapid single-tap selection.',
      ar: 'ترتيبك المخصص للفئات ينعكس تلقائياً في شريط الفئات الثابت فوق لوحة الأرقام لسرعة الاختيار بلمسة واحدة.',
    },
  },
];
