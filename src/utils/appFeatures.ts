import { FeatureItem, ReleaseNote } from '../types';

export type { FeatureItem, ReleaseNote };

export const APP_RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.1.51',
    releaseDate: 'October 27, 2026',
    title: {
      en: 'Native Vertical Scrolling Fix & Pure CSS Horizontal Page Swiping Engine',
      ar: 'إصلاح التمرير الرأسي الشامل ومحرك السحب الأفقي الطبيعي عبر الصفحات',
    },
    highlights: {
      en: [
        'Natural Vertical Scrolling Restored: Eliminated nested scroll traps and artificial touch captures across Home, Budget, Insights, Accounts, and Calculator views.',
        'Real Native Horizontal Page Swiping: Replaced laggy JS animation transforms with native CSS scroll-snap (overflow-x: auto, snap-x mandatory) for silky-smooth 120 FPS page switching.',
        'Unconstrained Segmented Controls: Redesigned SwipeableTabs to render content in direct flow without overflow-hidden or height restrictions.',
      ],
      ar: [
        'استعادة التمرير الرأسي الطبيعي: إزالة كافة قيود التمرير المتداخلة وحبس الأحداث في صفحات الرئيسية، الميزانية، التحليلات، الحسابات، والحاسبة.',
        'سحب أفقي طبيعي وسلس بين الصفحات: استبدال تحريكات الجافاسكريبت بمحرك تمرير CSS طبيعي فائق السرعة وبدون أي بطء أو تقطيع.',
        'أزرار تنقل انسيابية: إعادة تصميم التبويبات الفرعية لعرض المحتوى مباشرة في الصفحة بحرية ودون حبس داخل حاويات مقيدة.',
      ],
    },
  },
  {
    version: '1.1.50',
    releaseDate: 'October 27, 2026',
    title: {
      en: 'Vertical Scroll Restoration, Gesture Direction Locking & Navigation Hierarchy Fix',
      ar: 'استعادة التمرير الرأسي الطبيعي، قفل اتجاه الإيماءات وإصلاح بنية التنقل',
    },
    highlights: {
      en: [
        'Native Vertical Scrolling Restored: Dedicated independent scroll view containers across Home, Budget, Insights, Accounts, and Calculator with touch-pan-y physics.',
        'Intelligent Direction Locking: Swipe carousels wait for 10px directional confirmation and immediately yield to vertical scrolling when vertical motion dominates.',
        'NavigationProvider & Error Safety: Fortified navigation hierarchy with safe fallback handlers, zero TDZ initialization issues, and English system defaults.',
      ],
      ar: [
        'استعادة التمرير الرأسي الطبيعي: حاويات تمرير مستقلة لصفحات الرئيسية، الميزانية، التحليلات، الحسابات، والحاسبة مع دعم فيزياء اللمس الرأسية.',
        'قفل ذكي لاتجاه الإيماءات: تنتظر أشرطة التمرير تأكيد الاتجاه الأفقي بمسافة 10 بكسل وتمنح الأولوية فوراً للتمرير الرأسي عند سحب القوائم.',
        'أمان التنقل وشاشات الأخطاء: بنية تنقل محصنة مع معالجة بديلة آمنة تمنع أي تعطل مع اعتماد اللغة الإنجليزية كخيار افتراضي.',
      ],
    },
  },
  {
    version: '1.1.49',
    releaseDate: 'October 27, 2026',
    title: {
      en: 'UI/UX Overhaul, 1:1 Gesture Carousels, Recurring Engine & Deep Navigation Stack',
      ar: 'تطوير تجربة المستخدم، التنقل بالسحب 1:1، محرك المعاملات الدورية وسجل التراجع المتعدد',
    },
    highlights: {
      en: [
        '3-State Gesture Guide & Lazy Loading: Reimagined user guide with instant dynamic code-splitting, 50/50 split view, full-screen swipe expansion, and ultra-concise subtitles.',
        'Deep Multi-Level Navigation Stack: Step-by-step hardware and browser back button support that unwinds nested popups, sub-pages, and drawers smoothly before root exit confirmation.',
        'Automated Recurring Rules Engine: Advanced multi-day, weekly, and monthly scheduling with deterministic timestamp preservation and long-press instant processing.',
        'Fluid 1:1 Drag-Swipe Carousels: Natural physical finger tracking across tabs, category screens, and shared spaces with smooth snapping physics.',
        'Dual-Account Transfer Cards & Sticky Keypad UX: Modern responsive transfer cards with dual accounts and a sticky category row pinned above the calculator keypad.',
      ],
      ar: [
        'دليل استخدام ثلاثي المراحل وتحميل مؤجل: دليل استخدام متطور مع تقسيم الشاشة 50/50، وتوسيع الشاشة بالسحب، وتحميل ذكي يوفر الذاكرة بالكامل.',
        'سجل تراجع متعدد الطبقات: دعم كامل لزر الرجوع بالهاتف والمتصفح لإغلاق النوافذ والقوائم والصفحات الفرعية تدريجياً وبسلاسة قبل تأكيد الخروج.',
        'محرك متقدم للمعاملات المتكررة: جدولة مرنة يومية وأسبوعية وشهرية مع الحفاظ على التوقيت الفعلي وخيار المعالجة الفورية بالضغط المطول.',
        'تنقل انسيابي بالسحب 1:1: تتبع دقيق لحركة الأصبع بين التبويبات وشاشات الفئات والمساحات المشتركة مع فيزياء توقف سلسة.',
        'بطاقات تحويل مطورة ولوحة أرقام ذكية: عرض أنيق لتحويلات الحسابات المزدوجة مع شريط فئات ثابت فوق لوحة الأرقام لسهولة الإدخال.',
      ],
    },
  },
  {
    version: '1.1.48',
    releaseDate: 'October 27, 2026',
    title: {
      en: 'App Reliability, Gesture Navigation & Multi-Level History Stack',
      ar: 'تحسين استقرار التطبيق والتنقل بالإيماءات وسجل التراجع المتعدد',
    },
    highlights: {
      en: [
        'Deep Multi-Level Navigation: Hardware and browser back buttons now smoothly close active popups, sub-pages, and drawers step-by-step before prompting to exit.',
        '1:1 Finger Tracking: Smooth horizontal drag gestures across tabs and category screens that physically follow your finger.',
        'Dark Boot Experience: Instant responsive startup screen with fluid scaling across phones of all sizes and zoom levels.',
      ],
      ar: [
        'سجل تراجع متعدد الطبقات: زر الرجوع بهاتفك أو المتصفح يغلق النوافذ والقوائم والصفحات الفرعية خطوة بخطوة قبل تأكيد الخروج.',
        'تنقل سلس يتتبع حركة الأصبع: سحب أفقي فوري بين التبويبات وشاشات الفئات يستجيب لحركة يدك بدقة ونعومة.',
        'بدء تشغيل داكن وسريع: شاشة تحميل سريعة وأنيقة مع توافق تام لجميع أحجام الشاشات ومستويات التكبير.',
      ],
    },
  },
  {
    version: '1.1.47',
    releaseDate: 'October 26, 2026',
    title: {
      en: 'Live Cloud Sync, Instant Change Catch-Up & Sidebar Status',
      ar: 'المزامنة السحابية اللحظية، تحديث فوري للتغييرات ومؤشر القائمة',
    },
    highlights: {
      en: [
        'Live Sync Status Indicator: A clean indicator inside the side menu displays your live connection status and last sync time without intrusive popups.',
        'Instant Cloud Updates: Any transaction, category, or account you create or edit syncs immediately to the cloud.',
        'Reliable Offline Queue: Edit freely without internet; all modifications queue up safely and sync automatically once you are back online.',
      ],
      ar: [
        'مؤشر حالة المزامنة بالقائمة: مؤشر مدمج وأنيق داخل القائمة الجانبية يوضح حالة الاتصال وتاريخ آخر مزامنة دون نوافذ منبثقة مزعجة.',
        'تحديثات سحابية فورية: أي معاملة أو فئة أو حساب تضيفه أو تعدله تتم مزامنته تلقائياً ولحظياً مع الخادم.',
        'حفظ مؤكد بدون إنترنت: سجّل كل مصروفاتك بحرية دون اتصال؛ يتم حفظ التعديلات وإرسالها تلقائياً فور عودة الإنترنت.',
      ],
    },
  },
  {
    version: '1.1.46',
    releaseDate: 'October 25, 2026',
    title: {
      en: 'Shared Spaces, Scheduled Recurring Rules & Transaction Numpad Overhaul',
      ar: 'المساحات المشتركة، المعاملات المتكررة وتطوير لوحة الأرقام',
    },
    highlights: {
      en: [
        'Family & Group Shared Spaces: Share dedicated budgets and financial spaces with family and friends in real time.',
        'Automated Repeating Rules: Schedule recurring salaries, rent, and monthly bills with automatic date and time preservation.',
        'Sticky Category Bar & Built-in Keypad: Choose categories easily above the keypad while typing transaction amounts.',
      ],
      ar: [
        'مساحات مشتركة للعائلة والشركاء: شارك ميزانيات مخصصة مع العائلة والأصدقاء لمتابعة المصروفات المشتركة لحظة بلحظة.',
        'معاملات دورية مجدولة: جدولة تلقائية للرواتب والإيجار والفواتير الدورية مع توثيق التوقيت بدقة.',
        'شريط فئات ثابت ولوحة أرقام متطورة: اختيار سريع للفئة مباشرة فوق لوحة الأرقام أثناء إدخال المبلغ.',
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
      en: 'Live Cloud Backup & Sync',
      ar: 'النسخ الاحتياطي والمزامنة السحابية',
    },
    subtitle: {
      en: 'Automatic cloud sync across devices',
      ar: 'مزامنة تلقائية عبر جميع أجهزتك',
    },
    description: {
      en: 'Keep your financial records safe and automatically synchronized across all your smartphones, tablets, and computers. Whenever you add an expense, transfer funds, or edit a category, your changes save to the secure cloud instantly so your balances always match.',
      ar: 'احتفظ بسجلاتك المالية آمنة ومحدثة تلقائياً عبر جميع هواتفك وأجهزتك اللوحية وحاسوبك. بمجرد إضافة أي مصروف أو تحويل أو تعديل فئة، تُحفظ بياناتك في السحابة فوراً لتبقى أرصدتك متطابقة دائماً في كل مكان.',
    },
    howToUse: {
      en: [
        'Open the side menu (tap the menu icon at the top left of the Home screen).',
        'Tap "Sign In with Google" at the bottom of the menu to link your account.',
        'Notice the subtle status dot in the menu showing "Synced" with your last sync time.',
        'Any transactions you record will now automatically back up in real time.',
      ],
      ar: [
        'افتح القائمة الجانبية بالضغط على زر القائمة أعلى الشاشة الرئيسية.',
        'اضغط على "تسجيل الدخول باستخدام جوجل" أسفل القائمة لربط حسابك.',
        'لاحظ مؤشر المزامنة الأنيق أسفل القائمة الذي يوضح حالة "متزامن" وتوقيت آخر حفظ.',
        'جميع المعاملات والتعديلات التي تجريها ستُحفظ تلقائياً في السحابة فور إدخالها.',
      ],
    },
    proTip: {
      en: 'You can work completely offline! All additions and edits are saved locally and will automatically sync the moment your device reconnects to the internet.',
      ar: 'يمكنك استخدام التطبيق بالكامل بدون إنترنت؛ حيث تُحفظ التعديلات في هاتفك وتُرفع تلقائياً للسحابة بمجرد عودة الاتصال.',
    },
  },
  {
    id: 'shared-spaces',
    icon: '👥',
    category: 'finance',
    title: {
      en: 'Shared Spaces & Family Budgeting',
      ar: 'المساحات المشتركة والميزانية العائلية',
    },
    subtitle: {
      en: 'Track shared expenses with others',
      ar: 'متابعة المصروفات المشتركة مع الآخرين',
    },
    description: {
      en: 'Create private collaborative spaces for families, roommates, travel groups, or joint projects. Everyone invited to a space can log expenses, track shared balances, and import transactions directly into their personal accounts with full privacy control.',
      ar: 'أنشئ مساحات مالية مشتركة خاصة للعائلة أو الشركاء في السكن أو مجموعات السفر والمشاريع المشتركة. يمكن لجميع الأعضاء تسجيل المصروفات، متابعة الرصيد المشترك، واستيراد المعاملات لحساباتهم الشخصية بخصوصية تامة.',
    },
    howToUse: {
      en: [
        'Open the side menu and select "Shared Spaces Hub".',
        'Tap "Create New Space", enter a space name, and choose a fun icon.',
        'Invite family or friends by sharing your invite link or entering their 16-digit ID.',
        'Tap the space to enter its statement, log shared spending, or import items into your personal accounts.',
      ],
      ar: [
        'افتح القائمة الجانبية واختر "المساحات المشتركة".',
        'اضغط على "إنشاء مساحة جديدة"، اكتب اسماً للمساحة واختر أيقونة مناسبة.',
        'قم بدعوة الشركاء بمشاركة رابط الدعوة أو إدخال معرّفهم المكون من 16 رقماً.',
        'اضغط على المساحة لمشاهدة كشف الحساب وتسجيل المصروفات المشتركة أو استيرادها لحسابك الشخصي.',
      ],
    },
    proTip: {
      en: 'Press and hold any transaction inside a shared space to select multiple items, then tap "Import to Account" to copy them into your personal account in one step.',
      ar: 'اضغط مطولاً على أي معاملة داخل المساحة المشتركة لتحديد عدة معاملات معاً، ثم اضغط "استيراد إلى حسابي" لنسخها دفعة واحدة.',
    },
  },
  {
    id: 'recurring-transactions',
    icon: '🔁',
    category: 'finance',
    title: {
      en: 'Scheduled Recurring Transactions',
      ar: 'المعاملات المتكررة المجدولة',
    },
    subtitle: {
      en: 'Automate repeating bills and salaries',
      ar: 'أتمتة الفواتير والرواتب الدورية',
    },
    description: {
      en: 'Never forget to record regular monthly expenses or income again. Set up automated schedules for salaries, apartment rent, internet bills, subscriptions, or savings contributions. Even if you open the app days later, all missed schedules catch up with their exact dates preserved.',
      ar: 'لا داعي للقلق بشأن نسيان تسجيل فواتيرك الدورية أو راتبك الشهري. اضبط مواعيد متكررة لراتبك، إيجار المنزل، اشتراكات الإنترنت، أو المدخرات. حتى وإن فتحت التطبيق بعد أيام، سيتم توثيق كافة المعاملات المستحقة بتواريخها الدقيقة.',
    },
    howToUse: {
      en: [
        'Tap the "+" button to open the Add Transaction screen.',
        'Turn on the "Recurring Transaction" toggle switch directly above the note field.',
        'Select your repeating frequency (daily, weekly, monthly, or yearly) and choose the time of day.',
        'Save the transaction. View, edit, or pause your schedules anytime from the side menu under "Recurring Transactions".',
      ],
      ar: [
        'اضغط على زر "+" لفتح نافذة إضافة معاملة جديدة.',
        'فعّل زر "معاملة متكررة" الموجود مباشرة أعلى حقل الملاحظات.',
        'اختر وتيرة التكرار (يومياً، أسبوعياً، شهرياً، أو سنوياً) وحدد توقيت التنفيذ.',
        'احفظ المعاملة؛ ويمكنك إدارة القواعد وإيقافها مؤقتاً في أي وقت من القائمة الجانبية عبر "المعاملات المتكررة".',
      ],
    },
    proTip: {
      en: 'In the Recurring Transactions list, long-press any scheduled rule to immediately process and record it ahead of its scheduled date.',
      ar: 'في قائمة المعاملات المتكررة، اضغط مطولاً على أي قاعدة لتنفيذها وتسجيلها في حسابك فوراً قبل موعدها المحدد.',
    },
  },
  {
    id: 'multi-select',
    icon: '☑️',
    category: 'core',
    title: {
      en: 'Multi-Select & Batch Actions',
      ar: 'التحديد المتعدد والإجراءات الجماعية',
    },
    subtitle: {
      en: 'Edit or delete multiple items',
      ar: 'تعديل أو حذف عدة عناصر',
    },
    description: {
      en: 'Manage your transactions and categories faster with powerful bulk selection tools. Select multiple transactions across days, or pick an entire day or month at once, to delete, transfer, or export them in a single tap.',
      ar: 'أدر معاملاتك وفئاتك بسرعة أكبر مع ميزة التحديد الجماعي. حدد عدة معاملات عبر أيام مختلفة، أو اختر يوماً أو شهراً كاملاً بضغطة واحدة لحذفها أو نقلها أو تصديرها في لحظة.',
    },
    howToUse: {
      en: [
        'Press and hold any transaction card on the Home screen to enter Multi-Select mode.',
        'Tap additional transaction cards to select or unselect them.',
        'Tap a day header to quickly select all transactions recorded on that date.',
        'Use the bottom action bar to delete or batch process all selected items.',
      ],
      ar: [
        'اضغط مطولاً على أي معاملة في الشاشة الرئيسية للدخول في وضع التحديد المتعدد.',
        'المس أي معاملات إضافية لتحديدها أو إلغاء تحديدها.',
        'المس عنوان أي يوم لتحديد جميع المعاملات المسجلة في ذلك اليوم بلمسة واحدة.',
        'استخدم شريط الإجراءات العائم بالأسفل لحذف أو معالجة جميع العناصر المحددة معاً.',
      ],
    },
    proTip: {
      en: 'Tapping the checkmark icon in the top header instantly selects every transaction in the current month for quick batch management.',
      ar: 'الضغط على أيقونة الصح أعلى القائمة يتيح لك تحديد كافة معاملات الشهر الحالي بلمسة واحدة لإدارتها بسرعة.',
    },
  },
  {
    id: 'swipe-carousel',
    icon: '👆',
    category: 'core',
    title: {
      en: 'Finger-Tracking Swipe Navigation',
      ar: 'التنقل بالسحب وتتبع الأصبع',
    },
    subtitle: {
      en: 'Fluid gesture-based page switching',
      ar: 'تنقل سريع وسلس بالسحب',
    },
    description: {
      en: 'Experience natural, physical gesture navigation. The app smoothly follows your finger horizontally as you glide between bottom tabs, expense/income categories, and shared spaces tabs, snapping into place with smooth physics.',
      ar: 'استمتع بتنقل طبيعي وانسيابي يعتمد على الإيماءات الحركية. تتتبع الشاشات حركة أصبعك أفقياً بدقة أثناء التبديل بين التبويبات السفلية، فئات المصروفات والإيرادات، وقوائم المشاركة لتستقر بسلاسة فائقة.',
    },
    howToUse: {
      en: [
        'Place your finger anywhere on the screen and swipe horizontally left or right to switch main tabs.',
        'In the Categories screen, swipe across the page to glide smoothly between Expense and Income views.',
        'In the Shared Spaces Hub, swipe across to move between "My Shares" and "Shared with Me".',
      ],
      ar: [
        'ضع أصبعك على أي مكان في الشاشة واسحب أفقياً يميناً أو يساراً للتبديل بين التبويبات الرئيسية.',
        'في شاشة الفئات، اسحب جانباً للتنقل الفوري بين فئات المصروفات وفئات الإيرادات.',
        'في شاشة المساحات المشتركة، اسحب للتبديل بسهولة بين "مشاركاتي" و"مشارك معي".',
      ],
    },
  },
  {
    id: 'built-in-calculator',
    icon: '🧮',
    category: 'finance',
    title: {
      en: 'Integrated Financial Calculator',
      ar: 'حاسبة مالية مدمجة ذكية',
    },
    subtitle: {
      en: 'Calculate amounts directly in transactions',
      ar: 'حساب المبالغ مباشرة داخل المعاملة',
    },
    description: {
      en: 'No need to switch between calculator apps and note down numbers. Perform instant additions, subtractions, multiplications, and divisions directly on the transaction keypad, or use the dedicated full-screen Calculator tab in the bottom bar.',
      ar: 'لا حاجة للتبديل بين تطبيقات الآلة الحاسبة وكتابة الأرقام يدوياً. قم بعمليات الجمع والطرح والضرب والقسمة مباشرة من لوحة أرقام المعاملة، أو استخدم تبويب الحاسبة المستقل في الشريط السفلي.',
    },
    howToUse: {
      en: [
        'When entering a transaction amount, tap any math operator (+, −, ×, ÷) right on the numpad.',
        'Type your numbers and tap the "=" key to calculate the total amount automatically.',
        'For standalone calculations, tap the "Calculator" tab in the bottom navigation bar.',
      ],
      ar: [
        'أثناء إدخال مبلغ المعاملة، اضغط على أي علامة حسابية (+، −، ×، ÷) مباشرة على لوحة الأرقام.',
        'اكتب الأرقام واضغط على علامة "=" ليتم احتساب الإجمالي تلقائياً في خانة المبلغ.',
        'لإجراء عمليات حسابية عامة، اضغط على تبويب "الحاسبة" الموجود في الشريط السفلي.',
      ],
    },
  },
  {
    id: 'multi-accounts',
    icon: '💳',
    category: 'finance',
    title: {
      en: 'Multiple Accounts & Running Balances',
      ar: 'حسابات متعددة وتتبع الرصيد',
    },
    subtitle: {
      en: 'Track cash, banks, and wallets',
      ar: 'تتبع الحسابات البنكية والمحافظ والنقد',
    },
    description: {
      en: 'Organize your money exactly how it exists in real life. Track your main bank accounts, credit cards, cash wallets, and emergency savings separately. Every transaction records the running balance before and after, making auditing and reconciliation effortless.',
      ar: 'نظّم أموالك كما هي في الواقع تماماً. قسّم ميزانيتك بين حساباتك البنكية، بطاقات الائتمان، المحافظ النقدية، ومدخرات الطوارئ بشكل مستقل. تسجل كل معاملة الرصيد قبل وبعد بدقة لسهولة مراجعة الحسابات.',
    },
    howToUse: {
      en: [
        'Tap the "Accounts" tab in the bottom navigation bar to see your total net worth and account list.',
        'Tap "+ Add Account" to create a new wallet or bank with custom starting balances and icons.',
        'Tap any account to open its full transaction history and see live running balance changes.',
      ],
      ar: [
        'اضغط على تبويب "الحسابات" في الشريط السفلي لعرض صافي ثروتك الإجمالية وقائمة حساباتك.',
        'اضغط على "+ إضافة حساب" لإنشاء محفظة جديدة أو بنك مع تحديد الرصيد الافتتاحي والأيقونة.',
        'اضغط على أي حساب لفتح كشف حسابه الكامل ومعرفة تفاصيل حركة الرصيد مع كل معاملة.',
      ],
    },
    proTip: {
      en: 'Mark sensitive personal accounts as "Private" in their account settings to exclude them from the public net worth total displayed on the Home screen.',
      ar: 'يمكنك تعيين الحسابات الشخصية كـ "حساب خاص" من إعدادات الحساب لإخفائها من إجمالي الرصيد الظاهر على الشاشة الرئيسية عند التواجد في مكان عام.',
    },
  },
  {
    id: 'custom-cycles',
    icon: '📅',
    category: 'finance',
    title: {
      en: 'Custom Payday Financial Cycles',
      ar: 'دورات الشهر المالي المخصصة',
    },
    subtitle: {
      en: 'Align monthly budgets with payday',
      ar: 'مزامنة ميزانيتك مع موعد الراتب',
    },
    description: {
      en: 'Match your budget with your actual payday instead of rigid calendar months. If your salary arrives on the 25th or 27th, configure your financial cycle to start on that day so your monthly spending resets right when your income arrives.',
      ar: 'طابق ميزانيتك مع موعد استلام راتبك الحقيقي بدلاً من الالتزام ببداية الشهر الميلادي. إذا كان راتبك ينزل يوم 25 أو 27 من كل شهر، اضبط دورتك المالية لتبدأ في ذلك اليوم ليتجدد حساب مصاريفك مع نزول الراتب.',
    },
    howToUse: {
      en: [
        'Tap the period header on the Home screen to view your active financial cycle.',
        'Choose "Reset Period" to start a fresh tracking cycle immediately or from a past moment.',
        'In Account Settings, set a custom "Start Day of Month" (e.g. 25) to align that account with your salary.',
      ],
      ar: [
        'اضغط على شريط الفترة المالية أعلى الشاشة الرئيسية لعرض تفاصيل دورتك الحالية.',
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
      en: 'Visual Budgets & Spending Limits',
      ar: 'ميزانيات الإنفاق وتحديد المصروفات',
    },
    subtitle: {
      en: 'Set monthly category spending caps',
      ar: 'تحديد حدود إنفاق شهرية للفئات',
    },
    description: {
      en: 'Keep your spending disciplined and prevent budget overruns. Assign monthly spending caps to categories like Groceries, Dining Out, Shopping, and Fuel. Visual progress meters display how much you have spent and how much remains.',
      ar: 'تحكّم في مصاريفك وتفادَ تجاوز الميزانية. حدد سقف إنفاق شهري لكل فئة مثل البقالة، المطاعم، التسوق، والوقود. توضح أشرطة التقدم الملونة ما صرفته وما تبقى لك بدقة لتنبيهك قبل نفاد الميزانية.',
    },
    howToUse: {
      en: [
        'Tap the "Budget" tab in the bottom navigation bar.',
        'Tap any category card to set or update its monthly spending limit.',
        'As you add transactions, the progress bar updates in real time and changes color as you approach your limit.',
      ],
      ar: [
        'اضغط على تبويب "الميزانية" في الشريط السفلي للتطبيق.',
        'المس أي فئة من فئات المصروفات لتحديد الحد الأقصى للإنفاق الشهري لها.',
        'مع كل معاملة تضيفها، يتحدث شريط التقدم فورياً ويتغير لونه لتنبيهك عند الاقتراب من الحد المحدد.',
      ],
    },
  },
  {
    id: 'offline-pwa',
    icon: '📱',
    category: 'pwa',
    title: {
      en: '100% Offline PWA Installation',
      ar: 'تثبيت كتطبيق وعمل بدون إنترنت',
    },
    subtitle: {
      en: 'Install on phone home screen',
      ar: 'تثبيت كامل على شاشة الهاتف',
    },
    description: {
      en: 'Install Money Manager directly on your phone home screen as a standalone application. It launches instantly in full screen with no browser address bar or search header, and functions at lightning speed even in airplane mode.',
      ar: 'قم بتثبيت التطبيق مباشرة على شاشة هاتفك الرئيسية ليعمل كتطبيق مستقل بملء الشاشة دون شريط عناوين المتصفح. يفتح التطبيق بسرعة فائقة ويعمل بكفاءة كاملة حتى في وضع الطيران بدون اتصال بالإنترنت.',
    },
    howToUse: {
      en: [
        'In your mobile browser (Chrome on Android or Safari on iOS), look for the "Install App" banner.',
        'Alternatively, open the browser menu and tap "Add to Home screen" or "Install App".',
        'Open Money Manager from your home screen icon to enjoy full-screen offline access.',
      ],
      ar: [
        'في متصفح هاتفك (كروم على أندرويد أو سفاري على آيفون)، ستظهر رسالة "تثبيت التطبيق".',
        'أو يمكنك فتح خيارات المتصفح والضغط على "إضافة إلى الشاشة الرئيسية" أو "تثبيت".',
        'افتح التطبيق من شاشة هاتفك مباشرة ليعمل بملء الشاشة وبدون أي اتصال بالإنترنت.',
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
      en: 'PIN & Fingerprint Privacy Lock',
      ar: 'قفل الحماية برمز السري والبصمة',
    },
    subtitle: {
      en: 'Protect financial records with security',
      ar: 'حماية بياناتك برمز سري وبصمة',
    },
    description: {
      en: 'Ensure your financial transactions and personal balances remain private. Protect the application with a 4-digit security PIN and fingerprint or Face Unlock authentication whenever the app is reopened.',
      ar: 'حافظ على خصوصية سجلاتك المالية وأرصدتك الشخصية بعيداً عن المتطفلين. يمكنك حماية التطبيق برمز مرور سري من 4 أرقام مع دعم بصمة الإصبع والتعرف على الوجه عند كل فتح للتطبيق.',
    },
    howToUse: {
      en: [
        'Open the side menu and tap the lock icon next to "App Lock".',
        'Enter a secure 4-digit PIN of your choice and confirm it.',
        'Whenever you switch away from the app or reopen it, the security screen prompts for your PIN or fingerprint.',
      ],
      ar: [
        'افتح القائمة الجانبية واضغط على أيقونة القفل بجانب "قفل التطبيق".',
        'اكتب رمز PIN سرياً مكوناً من 4 أرقام وقم بتأكيده.',
        'عند الخروج من التطبيق أو إعادة فتحه، ستظهر شاشة القفل فوراً لطلب الرمز السري أو البصمة.',
      ],
    },
  },
  {
    id: 'backup-restore',
    icon: '💾',
    category: 'core',
    title: {
      en: 'Data Export & Easy Restore',
      ar: 'تصدير البيانات واستعادتها بسهولة',
    },
    subtitle: {
      en: 'Export backups to standard JSON',
      ar: 'تصدير واستعادة ملفات النسخ الاحتياطي',
    },
    description: {
      en: 'You always maintain 100% complete ownership of your data. Export your entire financial history to a standard, unencrypted JSON backup file at any time, or restore your records onto any new phone in seconds.',
      ar: 'أنت تملك بياناتك المالية بالكامل بنسبة 100%. يمكنك تصدير سجلاتك بالكامل إلى ملف نسخ احتياطي قياسي بصيغة JSON في أي وقت، أو استعادة كافة حساباتك ومعاملاتك على هاتف جديد في ثوانٍ معدودة.',
    },
    howToUse: {
      en: [
        'Open the side menu and select "Backup & Restore".',
        'Tap "Download Backup" to save a complete JSON copy of your data to your phone storage.',
        'To restore on another device, tap "Restore Backup" and pick your saved file.',
      ],
      ar: [
        'افتح القائمة الجانبية واختر "النسخ الاحتياطي والاستعادة".',
        'اضغط على "تنزيل نسخة احتياطية" لحفظ ملف JSON يحتوي على كامل بياناتك على هاتفك.',
        'لاستعادة بياناتك على جهاز آخر، اضغط على "استعادة نسخة احتياطية" واختر الملف المحفوظ.',
      ],
    },
    proTip: {
      en: 'You can link your Google Drive in your User Profile to enable automated weekly or monthly cloud backups behind the scenes.',
      ar: 'يمكنك ربط حساب Google Drive من شاشة الملف الشخصي لتفعيل النسخ الاحتياطي التلقائي أسبوعياً أو شهرياً بدون أي تدخل يدوي.',
    },
  },
];
