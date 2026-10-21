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
  howToUse?: { en: string[]; ar: string[] };
}

export const APP_RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.1.7',
    releaseDate: 'October 21, 2026',
    title: {
      en: 'Floating Auto-Hide Header, Swipe-to-Close Sidebar, Calculator Square Root & Navigation Fixes, Unified Share Modal, Account Multi-Select & Balance Protection',
      ar: 'هيدر عائم متجاوب فورياً، إغلاق القائمة بالسحب، تصحيح جذر الحاسبة والمؤشر، نظام مشاركة موحد بالكامل، تحديد الحسابات المتعدد، وحماية الرصيد عند الحذف',
    },
    highlights: {
      en: [
        'True Floating Overlay Header: Top header is fixed above content with glass blur, sliding back down instantly on even a 2px upward scroll at any scroll position.',
        'Swipe-to-Close Sidebar: Intuitive swipe gesture in the closing direction (Left in LTR, Right in RTL) smoothly dismisses the sidebar.',
        'Calculator Phantom 0 Bug Fix: Eliminated the ghost trailing "0" (e.g. 5÷5|0), rendering placeholder "0" only when expression is completely empty.',
        'Calculator Square Root Navigation: Moving cursor Right (▶) cleanly exits the root block without getting trapped; accurate live evaluation of nested/complex roots.',
        'Calculator Light Mode Theme: Fully theme-aware display container and expandable history panel with bright morning backgrounds in light mode.',
        '100% Unified Share System: Every share across Accounts, Categories, Transactions, and Multi-Select uses the identical ShareFolderModal with automatic metadata inheritance.',
        'Account Multi-Select with Long-Press: 500ms long-press on any Account card enters multi-select mode for batch sharing or safe deletion.',
        'Remaining Balance Resolution: Financial safety prompt prevents losing money when deleting accounts with non-zero balances by offering automatic transfer to another account.',
      ],
      ar: [
        'هيدر عائم حقيقي فوق المحتوى: شريط علوي عائم بزجاج ضبابي يظهر فوراً وبدقة عند التمرير لأعلى حتى 2 بكسل في أي موضع من الصفحة.',
        'إغلاق القائمة الجانبية بالسحب: إمكانية سحب القائمة الجانبية في الاتجاه المعاكس (يسار في الإنجليزية، يمين في العربية) لإغلاقها بسلاسة.',
        'إزالة الصفر الشبح بالحاسبة: القضاء نهائياً على ظهور 0 بجانب المؤشر (5÷5|0) وقصر الصفر على حالة فراغ التعبير الحسابي تماماً.',
        'التنقل الدقيق داخل وخارج الجذر: الضغط على سهم اليمين يخرج من نطاق الجذر الرياضي واليسار يعود لداخله، مع حساب دقيق لجميع الجذور المركبة.',
        'مظهر نهاري مشرق لسجل الحاسبة: دعم كامل للوضع الفاتح في شاشة العرض وسجل العمليات الحسابية بخلفيات ناصعة وألوان عالية التباين.',
        'نظام مشاركة موحد 100%: كل عمليات المشاركة في الحسابات والتصنيفات والمعاملات والتحديد المتعدد أصبحت تستخدم نفس نافذة مجلد المشاركة الموحدة.',
        'تحديد الحسابات بالضغط المطول: ضغط مطول 500ms على أي كارت حساب للدخول في وضع التحديد المتعدد لمشاركة مجمعة أو حذف آمن.',
        'حماية الرصيد المتبقي عند حذف الحساب: نافذة ذكية تمنع ضياع الأموال عند حذف حساب به رصيد، وتتيح تحويل الرصيد المتبقي لحساب آخر تلقائياً قبل الحذف.',
      ],
    },
  },
  {
    version: '1.1.6',
    releaseDate: 'October 20, 2026',
    title: {
      en: 'App Performance Boost, 16-Digit Numeric ID, Dedicated Share Folders, Calculator Overhaul & Light Mode Contrast',
      ar: 'تسريع فائق للأداء، معرّف رقمي ثابت 16 رقماً، مجلدات مشاركة مستقلة، ترقية الحاسبة وتصحيح الوضع الفاتح',
    },
    highlights: {
      en: [
        'Massive Performance Boost: Inactive tabs are completely unmounted and context is strictly memoized, eliminating background re-render cascades and frame drops.',
        'Unified Header & Navigation: Standardized height (h-16 px-4) and instant slide-back on upward touch/scroll across all 5 navigation tabs.',
        'Fixed 16-Digit Numeric ID: Fixed 16-digit user ID formatted in 4-digit blocks (xxxx xxxx xxxx xxxx) with 1-tap copy and real-time inbox delivery.',
        'Dedicated Share Folders System: Sharing now creates isolated Share Folders completely separated from financial spending categories, automatically adopting item metadata.',
        'Calculator Square Root & Arrow Keys: Accurate square root engine with implicit multiplication and auto-closing parentheses, plus left/right arrow keys to navigate between numbers.',
        'Light Mode Equals (=) Button Fix: High-contrast vibrant blue styling ensuring the "=" symbol is always crisp and visible in both light and dark themes.',
        'Sidebar Polish: Entire profile banner is 100% clickable with duplicate Cloud Sync button removed.',
        'Real-Time Shared Inbox: Instant toast notifications when friends send share folders to your 16-digit ID with instant viewing under Shared with Me.',
      ],
      ar: [
        'تسريع فائق وإلغاء اللاج: إلغاء تحميل التبويبات غير النشطة تماماً مع حصر التحديثات على التبويب المفتوح فقط وتثبيت الذاكرة بـ useMemo.',
        'توحيد الهيدر والنافيجيشن: ارتفاع موحد (h-16 px-4) وظهور فوري وسلس للشريط العلوي بمجرد سحب الشاشة أو التمرير لأعلى.',
        'معرّف رقمي ثابت من 16 رقماً: معرّف موحد مقسم لأربع مجموعات (xxxx xxxx xxxx xxxx) مع زر نسخ بلمسة واحدة وصندوق وارد لحظي.',
        'نظام مجلدات مشاركة مستقل: فصل كامل للمشاركة في مجلدات مخصصة دون المساس بتصنيفات المصاريف، مع توارث تلقائي للاسم والأيقونة.',
        'إصلاح الجذر التربيعي وأسهم التنقل بالحاسبة: دعم دقيق لرمز الجذر والأقواس والضرب الضمني، مع أسهم يمين ويسار للتحرك بين الأرقام وتعديلها.',
        'إصلاح زر الناتج (=) في الوضع الفاتح: تباين لوني واضح وأزرق ناصع يمنع اختفاء رمز = أو ظهوره فارغاً في الوضع الفاتح.',
        'تحسين القائمة الجانبية: سيكشن البروفايل بالكامل أصبح زراً واحداً قابلاً للنقر مع إزالة زر المزامنة المكرر.',
        'صندوق وارد لحظي بالمشاركات: إشعار فوري عند إرسال أي صديق لمجلد مشاركة لمعرّفك الـ 16 رقماً وظهوره فوراً في "مشتركة معي".',
      ],
    },
  },
  {
    version: '1.1.5',
    releaseDate: 'October 20, 2026',
    title: {
      en: 'Unified Backup & Restore, Interactive Side-Strip, Multi-Select Mode & RTL Overhaul',
      ar: 'مركز النسخ الاحتياطي الموحد، الشريط الجانبي التفاعلي، وضع التحديد المتعدد وإصلاحات RTL',
    },
    highlights: {
      en: [
        'Unified Backup & Restore Hub: WhatsApp-style Google/Email cloud backup, reliable manual export, and real-time step-by-step progress bars (0-100%).',
        'Universal Interactive Feedback: Zero silent failures! Every create, edit, delete, copy, backup, and auth action triggers instant visual toast feedback.',
        'Interactive Side-Strip & Sliding Window: Initial full card view, collapsible side strip with 1-2 word titles, and slide-out peek behavior.',
        'Long-Press Multi-Select Mode: 500ms press-and-hold on transactions and categories with batch delete, instant sharing, and custom template bundles.',
        'Sharing Overhaul & GitHub Pages Fix: Offline guest snapshot sharing (?sharedData=...), subpath 404 resolution, and custom multi-account bundles.',
        'Smart Dynamic Filter Chips: Only renders filter chips that have applicable data in your records.',
        'Period Filters Standardized: Custom cycle renamed to "App Month" (1st option & default everywhere), standard calendar months to "This Month" & "Last Month".',
        'Android Hardware Back & Exit Modal: Instant responsive exit dialog with working Cancel/Exit buttons and sentinel history guard.',
        'Arabic (RTL) Navigation Fixed: Bottom navigation active indicator pill accurately follows tabs in RTL mode without inversion.',
        'Complete Light Mode Polish: Clean, high-contrast palette for cards, typography, headers, and modals.',
      ],
      ar: [
        'مركز النسخ الاحتياطي والاستعادة الموحد: نسخ سحابي على غرار واتساب مع شريط تقدم بصري خطوة بخطوة من 0% إلى 100%.',
        'تغذية راجعة شاملة وفورية: لا وجود لأي عمليات صامتة! كل إضافة وتعديل وحذف ونسخ ومزامنة تُظهر إشعاراً مرئياً فورياً.',
        'شريط جانبي تفاعلي ونافذة منزلقة للمميزات: عرض بطاقات كامل في البداية، تقليص لشريط جانبي مختصر، وسحب المعاينة للخارج بسلاسة.',
        'وضع التحديد المتعدد بالضغط المطول: ضغط 500ms على المعاملات والتصنيفات لإجراء الحذف والمشاركة الجماعية وإنشاء قوالب مشتركة.',
        'ترقية المشاركة وحل خطأ 404 على GitHub Pages: مشاركة فورية في وضع الضيف (?sharedData=...) مع حزم مخصصة متعددة الحسابات.',
        'شرائح تصفية ديناميكية ذكية: إخفاء تلقائي للخيارات الفارغة التي لا تحتوي على بيانات.',
        'إعادة تسمية وترتيب فترات العرض: "شهر التطبيق" كخيار أول وافتراضي دائماً، و"هذا الشهر" و"الشهر الماضي" للأشهر التقويمية.',
        'إصلاح زر الرجوع في أندرويد ونافذة تأكيد الخروج: استجابة دقيقة وأزرار تعمل بسلاسة دون تعليق.',
        'إصلاح الشريط السفلي في الواجهة العربية (RTL): المؤشر النشط يتبع التبويب الصحيح تماماً دون انعكاس.',
        'تجديد شامل للوضع الفاتح: تباين عالي وتناسق لوني مريح للعين في جميع الشاشات والنوافذ.',
      ],
    },
  },
  {
    version: '1.1.4',
    releaseDate: 'October 20, 2026',
    title: {
      en: 'Full-Screen Pro Calculator, Smart Auto-Hiding Headers, Background Scroll Lock & Security Overhaul',
      ar: 'حاسبة احترافية ملء الشاشة، شريط علوي ذكي، قفل التمرير الخلفي وتحديث شامل للأمان',
    },
    highlights: {
      en: [
        'Full-Screen Non-Scrollable Calculator: Mathematical typography (√, ^, %, ÷, ×, −, +) with precision engine and in-display history.',
        'Smart Auto-Hiding Headers: Headers slide away smoothly on scroll down and immediately return on scroll up across views.',
        'Universal Sidebar Menu (☰): Accessible directly from top header across all 5 main navigation tabs.',
        'Background Scroll Lock: Freezes underlying viewport scroll whenever any modal, popup, or drawer is active.',
        'Accounts Card Polish & Free Initial Balance Editing: Reorder controls moved away from balance, shared box cleaned up, and initial/adjustment transactions are freely editable.',
        'User Profile ID & Email Photo Banner: Dedicated full-width User ID row with instant copy and one-tap email avatar suggestion banner.',
        'Symmetrical PIN Keypad & WebAuthn Passkeys: Redesigned modern numeric keypad, immediate lock persistence, and platform biometric credentials.',
        'Complete Factory Reset: Explicit Firebase sign-out, storage wipe, and IndexedDB purge for clean app reset.',
      ],
      ar: [
        'حاسبة مالية متقدمة ملء الشاشة: رموز رياضية حقيقية (√, ^, %, ÷, ×, −, +) ومحرك حسابات فائق الدقة مع سجل داخل الشاشة.',
        'شريط علوي ذكي للإخفاء التلقائي: انزلاق سلس للشريط عند التمرير لأسفل وظهوره فوراً عند التمرير لأعلى.',
        'زر القائمة الجانبية الموحد (☰): وصول مباشر للقائمة من الشريط العلوي عبر جميع التبويبات الخمسة.',
        'قفل التمرير الخلفي عند فتح النوافذ: منع تمرير الصفحة السفلية عند فتح أي نافذة منبثقة أو قائمة.',
        'تحسين بطاقات الحسابات وتحرير الرصيد الأولي: فصل أسهم الترتيب عن الرصيد وحرية تعديل المعاملات الافتتاحية.',
        'معرف الحساب واقتراح صورة البريد: صف كامل لنسخ المعرف بنقرة واحدة واقتراح اعتماد صورة الحساب كأفاتار.',
        'لوحة أرقام PIN متناسقة ومفاتيح مرور WebAuthn: لوحة مفاتيح عصرية ومصادقة بيومترية حقيقية.',
        'إعادة ضبط المصنع الكاملة: تسجيل خروج صريح ومسح التخزين وقواعد IndexedDB بالكامل.',
      ],
    },
  },
  {
    version: '1.1.3',
    releaseDate: 'October 19, 2026',
    title: {
      en: 'Native In-Profile Auth, Standalone Shared Live Viewer, & Priority Reordering',
      ar: 'المصادقة المدمجة بالملف الشخصي، عارض الحسابات المباشر، وإعادة ترتيب الأولوية',
    },
    highlights: {
      en: [
        'Redesigned Native Authentication: Clean mobile account card inside User Profile with Google One-Tap, Email, and Phone OTP without backend jargon.',
        'Standalone Shared Account Live Dashboard: Dedicated shared-view.html and direct ?sharedAccountId=... URL parameter live view without login required.',
        'Dedicated Shared Accounts Manager: Hub in Sidebar and Accounts View to manage shared links and follow family accounts in real time.',
        'Contextual Account Pre-Selection & Auto-Pairing: Automatic account pre-selection when opening transactions from account pages and smart destination pairing.',
        'Account Priority Reordering: Up/Down arrow controls on account cards with immediate primary default account synchronization.',
      ],
      ar: [
        'تصميم أصيل للمصادقة بالملف الشخصي: بطاقة حساب عصرية مدمجة تدعم جوجل والبريد والهاتف دون مصطلحات تقنية معقدة.',
        'لوحة مباشرة للحسابات المشتركة: ملف shared-view.html مستقل وتوافق مع الرابط المباشر ?sharedAccountId=... دون الحاجة لتسجيل.',
        'إدارة الحسابات المشتركة: مركز متكامل في القائمة الجانبية وصفحة الحسابات لمتابعة الحسابات ومشاركتها لحظياً.',
        'تحديد مسبق وإقران تلقائي: اختيار الحساب تلقائياً عند إضافة معاملة من صفحة الحساب وإقران ذكي لحساب التحويل.',
        'أزرار إعادة ترتيب أولوية الحسابات: أسهم ترتيب فورية في بطاقات الحسابات مع تعيين الحساب الأول كافتراضي.',
      ],
    },
  },
  {
    version: '1.1.2',
    releaseDate: 'October 18, 2026',
    title: {
      en: 'Firebase Sync & Auth, Interactive Photo Cropper, Shared Accounts & Master Polish',
      ar: 'المزامنة ومصادقة Firebase، محرر وقاص الصور التفاعلي، الحسابات المشتركة وتحسينات متقدمة',
    },
    highlights: {
      en: [
        'Real Firebase Integration: One-tap Google Auth, Email/Password, Phone OTP login, and Realtime Database live sync.',
        'Interactive Circular Photo Cropper: Zoom (slider + pinch) and Drag/Pan with compressed WebP/JPEG canvas export.',
        'Cool Avatar Presets: Curated collection of modern Animal and People avatars matching OLED dark aesthetics.',
        'Shared Accounts Hub: Share read-only live account pages via standalone shared-view.html and followed shared accounts.',
        'Massive 150+ Icon Library: Organized into 6 categories with live keyword search and custom emoji keyboard input.',
        'Calendar Cell Overflow Fix: Smart compact number notation (e.g., 1.2k) and +N more indicator preventing day cell clipping.',
        'Global Click-Outside Auto-Close: Automatic outside click dismissal across all dropdowns, three-dots menus, and popovers.',
        'Account Context Pre-selection & Priority Reordering: Contextual account pre-selection, transfer auto-pairing, and account reordering.',
      ],
      ar: [
        'تكامل Firebase حقيقي: تسجيل الدخول بنقرة عبر جوجل، البريد، الهاتف OTP ومزامنة فورية لقاعدة البيانات.',
        'محرر وقاص الصور التفاعلي: تكبير وتصغير وسحب داخل إطار دائري وتصدير مضغوط بدقة فائقة.',
        'مكتبة صور رمزية مميزة: مجموعة مختارة من شخصيات الحيوانات والبشر بتصميم داكن فاخر.',
        'مركز الحسابات المشتركة: مشاركة صفحات الحسابات للقراءة فقط عبر ملف مستقل ومتابعة الحسابات المشتركة.',
        'مكتبة أيقونات ضخمة 150+: تصنيف في 6 تبويبات وبحث فوري وإدخال إيموجي مخصص.',
        'إصلاح تداخل خلايا التقويم: أرقام مدمجة ومؤشر لعدد المعاملات الإضافية لمنع قص الأرقام.',
        'إغلاق تلقائي عند النقر خارج القوائم: إغلاق فوري لكافة القوائم المنسدلة والنوافذ الفرعية.',
        'تحديد مسبق وإعادة ترتيب الحسابات: اختيار الحساب التلقائي، إقران التحويلات، وترتيب أولوية الحسابات.',
      ],
    },
  },
  {
    version: '1.1.1',
    releaseDate: 'October 18, 2026',
    title: {
      en: 'Biometric & PIN App Lock, Smart Budget Alerts, Recurring Transactions & Polish',
      ar: 'قفل التطبيق بالبصمة ورمز PIN، تنبيهات الميزانية الذكية، المعاملات المتكررة وتحسينات شاملة',
    },
    highlights: {
      en: [
        'Biometric & PIN App Lock: Secure app access with WebAuthn fingerprint/Face ID and custom 4-digit PIN authentication on startup and resume from background.',
        'Smart Budget Alerts: Proactive velocity & spending threshold alerts warning at 80% and 100% budget limit with dynamic badges.',
        'Recurring Transactions Engine: Schedule automatic daily, weekly, bi-weekly, monthly, or yearly recurring expenses & incomes with auto-post.',
        'GitHub Pages 100% Compatibility: Relative base path assets preventing blank screens on custom domains & GitHub Pages.',
        'Unified Feature Directory: Master-Detail directory with step-by-step guides, search, and release notes with fixed badge wrapping.',
        'Smooth Accordion Animations: Fluid height and opacity transitions for all collapsible panels and menus.',
        'Android Hardware Back Button Full Sync: Popstate navigation stack closing modals, drawers, and providing exit confirmation.',
      ],
      ar: [
        'قفل التطبيق بالبصمة ورمز PIN: حماية متكاملة عبر البصمة والتعرف على الوجه ورمز PIN مخصص عند فتح التطبيق والعودة من الخلفية.',
        'تنبيهات الميزانية الذكية: تحذيرات استباقية ومعدل إنفاق عند بلوغ 80% وتجاوز 100% من الميزانية مع شارات تنبيه ذكية.',
        'محرك المعاملات المتكررة: جدولة المعاملات الدورية (يومية، أسبوعية، شهرية، سنوية) مع ترحيل تلقائي وتنبيهات استحقاق.',
        'توافق كامل مع صفحات GitHub: مسارات نسبية للأصول لمنع الشاشات البيضاء عند النشر على الاستضافات المختلفة.',
        'دليل مميزات موحد: تصميم رئيسي-تفصيلي متكامل مع إرشادات خطوة بخطوة وتنسيق محكم للشارات.',
        'انسيابية الأكورديون والقوائم القابلة للطي: حركات انسيابية ناعمة لفتح وإغلاق جميع الأقسام.',
        'مزامنة زر الرجوع لهواتف أندرويد: تكامل مكدس التاريخ لإغلاق النوافذ المنبثقة وتأكيد الخروج.',
      ],
    },
  },
  {
    version: '1.1.0',
    releaseDate: 'October 17, 2026',
    title: {
      en: 'Major Release: 5th Tab Calculator, Gesture Navigation, Hardware Back & Offline Upgrades',
      ar: 'إصدار رئيسي: الحاسبة المتقدمة، التنقل بالإيماءات، زر الرجوع للهاتف وترقيات شاملة',
    },
    highlights: {
      en: [
        'Interactive Analogue Clock: Sleek clock face with hour/minute hands, AM/PM toggle, and dial tap/drag replacing button lists.',
        'Scroll & Slide Page Animations: Fluid transitions and horizontal scrolling effects between tabs and views.',
        'Semi-Transparent Popups: Elegant translucent glassmorphic backdrops and smooth close animations across all modals.',
        'Android Hardware Back Button Sync: Native back navigation across all modals and subviews with confirmation dialog before exit.',
        'Advanced Financial Calculator: 5th bottom navigation tab with expression tape, memory keys, percentages, and instant transaction creation.',
        'Interactive Master-Detail Guide: Full-screen feature directory with dynamic step-by-step guides and release notes.',
        'Horizontal Swipe Gestures: Smooth fluid sliding indicator across 5 tabs and swipe navigation between sub-views.',
        'Categories Directory & Advanced Search: Real-time search across categories in both Transactions and Budget views.',
        'Translucent Floating Date & Time Pickers: Semi-transparent blurred backdrop overlay for all date selections.',
        'Interactive Photo Cropper & Cool Avatars: Zoom, pan, and circular frame crop for custom avatars alongside cool animal/people presets.',
        'World Currency Selector: Over 22 global currencies with instant symbol updates across all views.',
        'Automated Scheduled Backups: Local folder persistence via File System Access API with background sync.',
        'Granular JSON Export: Persistent checklist modal to selectively backup accounts, budgets, profile, or complete state.',
      ],
      ar: [
        'ساعة عقارب تناظرية تفاعلية: تصميم كلاسيكي أنيق مع عقارب الساعات والدقائق وزر AM/PM واختيار مباشر بالنقر والسحب.',
        'حركات وتأثيرات التمرير بين الصفحات: انتقال سلس ومتحرك بين الأقسام والتبويبات كشريط أفقي متصل.',
        'نوافذ منبثقة بخلفيات شبه شفافة وحركات إغلاق: مظهر زجاجي شفاف فاخر مع انسيابية تامة عند الإغلاق.',
        'دعم زر الرجوع لهواتف أندرويد: تكامل تام للتنقل وإغلاق النوافذ المنبثقة مع نافذة تأكيد الخروج.',
        'حاسبة مالية متقدمة: تبويب خامس مستقل مع سجل حسابات، مفاتيح ذاكرة، نسب مئوية وتصدير فوري للمعاملات.',
        'دليل تفاعلي متقدم للمميزات: نافذة رئيسية وتفصيلية متطورة تشرح كيفية استخدام كل ميزة خطوة بخطوة.',
        'تنقل بالإيماءات والسحب الأفقي: مؤشر متحرك سلس بين التبويبات الخمسة ودعم السحب بين الأقسام.',
        'دليل الفئات والبحث السريع: بحث فوري متقدم في شاشة المعاملات وشاشة الميزانية.',
        'تقويم وساعة عائمة بخلفية شبه شفافة: مظهر عصري أنيق لجميع محددات الوقت والتاريخ.',
        'محرر وقاص الصور الشخصية: تكبير وسحب وقص دائري للصور ومكتبة صور رمزية أنيقة.',
        'محدد العملات العالمي: دعم أكثر من 22 عملة عالمية مع تحديث الرموز فورياً.',
        'نسخ احتياطي تلقائي مجدول: حفظ دوري في مجلد محلي بالخلفية عبر File System Access API.',
        'تخصيص تصدير البيانات: قائمة مرئية دائمة لاختيار ما تريد تصديره واستعادته بدقة 100%.',
      ],
    },
  },
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
