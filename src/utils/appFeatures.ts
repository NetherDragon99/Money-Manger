import { FeatureItem, ReleaseNote } from '../types';

export type { FeatureItem, ReleaseNote };

export const APP_RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.1.59',
    releaseDate: 'October 28, 2026',
    title: {
      en: 'Unified Recurring Schedules: Connected Weekday & Month-Day Filters, Multi-Time Overrides & Cloud Sync',
      ar: 'جدولة دورية موحدة: ربط فلاتر الأسبوع والشهر، توقيتات مخصصة ومزامنة سحابية شاملة',
    },
    highlights: {
      en: [
        'Dedicated Times Daily Tab: Unified multi-time scheduling with default fallback execution times and per-day multi-time overrides for specific weekdays and month days.',
        'Connected Weekday & Month-Day Filters: Run recurring rules on specific weekdays only within chosen month days without locking to Day 1.',
        'Bi-Weekly Calendar Preset: Accurate every-2-weeks interval calculated using calendar dates to eliminate DST time shifts.',
        'Anti-Duplicate Cloud & Share Sync: Real-time propagation of scheduled and retroactively edited rules with effectiveFrom timestamp boundaries to prevent duplicate catch-up transactions.',
      ],
      ar: [
        'تبويب مخصص لأوقات اليوم: إدارة شاملة للتوقيت الافتراضي مع إمكانية تحديد عدة أوقات مخصصة لأيام محددة من الأسبوع أو الشهر.',
        'ربط فلاتر أيام الأسبوع وأيام الشهر: جدولة المعاملات في أيام محددة من الأسبوع ضمن أيام معينة من الشهر دون تقييد باليوم الأول.',
        'خيار كل أسبوعين الدقيق: حساب فترة الأسبوعين بالتقويم الفعلي لمنع أي تغيير في التوقيت بسبب التوقيت الصيفي.',
        'مزامنة سحابية ومنع التكرار: مزامنة فورية للقواعد والتعديلات بأثر رجعي مع حدود زمنية تمنع تكرار المعاملات المتأخرة عبر السحابة والمساحات المشتركة.',
      ],
    },
  },
  {
    version: '1.1.58',
    releaseDate: 'October 28, 2026',
    title: {
      en: 'Interactive Recurring Rule Editing, Scheduled Catch-Up & Advanced Timing',
      ar: 'تحرير تفاعلي للقواعد المتكررة، تنفيذ دقيق للمواعيد السابقة وجدولة متقدمة',
    },
    highlights: {
      en: [
        'Interactive Rule Editing: Click any recurring rule to edit details and schedule with a choice between "Future only" or "Past & future" retroactive updates.',
        'Exact Scheduled Date & Time Catch-Up: Missed occurrences preserve their exact scheduled timestamp (never app-open time) with deterministic deduplication and instant auto-backup.',
        '100% Full Transaction Cloning: Automated transactions preserve original descriptions, notes, categories, and account metadata with visual recurring badges across all views.',
        'Simple Presets & Advanced Multi-Day Scheduling: One-tap presets (Daily/Weekly/Monthly) plus advanced controls for specific weekdays, custom per-day times, month days, and intra-day repeat times.',
      ],
      ar: [
        'تحرير تفاعلي للقواعد المتكررة: النقر على أي قاعدة متكررة لفتح شاشة التعديل الكاملة مع خيار تطبيق التعديل على "المعاملات القادمة فقط" أو "السابقة والقادمة".',
        'تنفيذ دقيق للمواعيد المجدولة السابقة: المعاملات المتأخرة تسجل بدقة تاريخها ووقتها المجدولين (وليس وقت فتح التطبيق) مع منع التكرار ومزامنة النسخ السحابي فوراً.',
        'استنساخ كامل 100% للمعاملات: الحفاظ الكامل على الأوصاف والتصنيفات الأصلية مع إظهار شارة مميزة للمعاملات المتكررة في جميع الشاشات والمساحات المشتركة.',
        'خيارات بسيطة وجدولة متقدمة: قوالب سريعة بنقرة واحدة (يومي/أسبوعي/شهري) مع وضع متقدم يتيح تحديد أيام الأسبوع بأوقات مخصصة وأيام الشهر وتكرارات متعددة في اليوم.',
      ],
    },
  },
  {
    version: '1.1.57',
    releaseDate: 'October 28, 2026',
    title: {
      en: 'Real-Time Shared Spaces Overhaul: Instant Sync, Live Profiles & Member Cleanup',
      ar: 'تحديث شامل للمساحات المشتركة: مزامنة فورية، هويات حية وتنظيم الأعضاء',
    },
    highlights: {
      en: [
        'Instant Real-Time Invites & Smart Reset: Shared spaces appear instantly upon invitation without app reload, with one-time notifications that cleanly reset on re-invite.',
        'Low-Bandwidth Transaction Sync: Creating, editing, or deleting transactions from inside or outside share views immediately syncs delta updates across both in-app ID shares and link shares.',
        'Live Profile Broadcast & Avatars: Profile display names, custom photos, and chosen icon avatars sync in real time across member badges and transaction author chips.',
        'Deduplicated Member Directory: Saved contacts are strictly deduplicated by unique ID, stale accounts are automatically pruned from the server, and manual removal is supported.',
      ],
      ar: [
        'دعوات فورية لحظية وإشعارات ذكية: تظهر المساحات المشتركة فور إرسال الدعوة دون الحاجة لتحديث التطبيق، مع إشعار لمرة واحدة يتجدد بذكاء عند إعادة الدعوة.',
        'مزامنة فورية خفيفة للمعاملات: إضافة أو تعديل أو حذف المعاملات من أي مكان داخل التطبيق أو خارجه يرسل التحديث فوراً لجميع الأعضاء وروابط المشاركة.',
        'مزامنة الهوية والصور الحية: تحديث فوري لاسم المستخدم وصورته والرموز التعبيرية المختارة عبر شارات الأعضاء وبطاقات كاتب المعاملة.',
        'تنظيم جهات الاتصال وحذف المكررات: دمج وتنظيم جهات الاتصال السابقة بدقة حسب المعرّف الفريد، مع حذف الحسابات غير الموجودة وإتاحة خيار الإزالة اليدوية.',
      ],
    },
  },
  {
    version: '1.1.56',
    releaseDate: 'October 27, 2026',
    title: {
      en: 'User Profile Navigation Fix & Dedicated Cloud Account Menu Access',
      ar: 'إصلاح فتح صفحة الملف الشخصي وتوفير زر وصول مباشر للحساب السحابي',
    },
    highlights: {
      en: [
        'Instant Profile Launch: Fixed an issue where tapping the user profile header failed to open due to a navigation popstate conflict, now opening cleanly and reliably.',
        'Dedicated Menu Action: Added an explicit "User Profile & Cloud Account" button in the sidebar drawer for convenient one-tap access.',
      ],
      ar: [
        'فتح فوري للملف الشخصي: إصلاح تعطل فتح صفحة الملف الشخصي بسبب تعارض في سجل التنقل لتفتح فوراً وبسلاسة تامة بمجرد النقر.',
        'زر وصول مخصص: إضافة زر مباشر ومميز "الملف الشخصي والحساب السحابي" في القائمة الجانبية لسهولة إدارة الحساب والمزامنة.',
      ],
    },
  },
  {
    version: '1.1.55',
    releaseDate: 'October 27, 2026',
    title: {
      en: 'Streamlined 2-Page Feature Guide & Instant Swipe Return',
      ar: 'تبسيط دليل المميزات لصفحتين مباشرين مع العودة الفورية بالسحب',
    },
    highlights: {
      en: [
        'Direct 2-Page Flow: Skipped the intermediate split layout for an immediate, focused detail view with a thin quick-access sidebar upon tapping any feature card.',
        'Instant Swipe Return: A single horizontal swipe gesture now immediately returns you from the detail view directly back to the first directory cards grid.',
      ],
      ar: [
        'تنقل مباشر ومبسط بين صفحتين: إلغاء العرض المقسم الوسيط للانتقال فوراً للشريط الجانبي المدمج مع لوحة الشرح المفصلة عند لمس أي بطاقة.',
        'عودة فورية بالسحب: إيماءة سحب أفقية واحدة تعيدك مباشرة وبسلاسة تامة من لوحة التفاصيل إلى شبكة البطاقات الأولى.',
      ],
    },
  },
  {
    version: '1.1.54',
    releaseDate: 'October 27, 2026',
    title: {
      en: 'Feature Directory 3-State Motion Layout, Thin Sidebar & Swipe Gestures',
      ar: 'دليل المميزات التفاعلي ثلاثي المراحل، شريط جانبي مدمج وتنقل انسيابي بالسحب',
    },
    highlights: {
      en: [
        'Interactive 3-State Motion Architecture: Tapping any card smoothly shrinks the feature list into a thin quick-access sidebar showing icons and titles while expanding the rich detail panel.',
        'Directional Swipe Transitions: Swipe left-to-right to push the detail panel into a 50/50 split view, and swipe again to return seamlessly to the full directory card grid.',
        'Dedicated "Where to Find It" Guide: Every single feature now includes explicit in-app navigation routes alongside thorough descriptions, actionable usage steps, and pro tips.',
        'Instant Real-Time Detail Switching: Tapping any icon or title in the thin sidebar instantly switches the active feature without reloading or lag.',
      ],
      ar: [
        'بنية تفاعلية حركية ثلاثية المراحل: النقر على أي بطاقة يقلص قائمة المميزات بسلاسة إلى شريط جانبي مدمج للأيقونات والعناوين مع فتح لوحة التفاصيل الشاملة.',
        'تنقل انسيابي بالسحب الاتجاهي: اسحب من اليسار إلى اليمين لتوسيع العرض إلى وضع منصف 50/50، واسحب مرة أخرى للعودة إلى شبكة البطاقات الأولية.',
        'دليل مخصص "أين تجد هذه الميزة": توثيق دقيق للمسار داخل التطبيق لكل ميزة مع شروحات مفصلة، خطوات استخدام عملية، وتلميحات ذكية.',
        'تبديل فوري لتفاصيل الميزة: لمس أي أيقونة أو عنوان في الشريط الجانبي يُحدث بيانات الشاشة فوراً وبسلاسة تامة.',
      ],
    },
  },
  {
    version: '1.1.53',
    releaseDate: 'October 27, 2026',
    title: {
      en: 'Real-Time Bottom Navigation Sync on Hand Swipe & Fast Gesture Coordination',
      ar: 'مزامنة فورية ولحظية لشريط التنقل السفلي أثناء السحب السريع باليد',
    },
    highlights: {
      en: [
        'Instant Real-Time Footer Synchronization: The bottom navigation bar indicator pill and active tab now update instantly the exact moment the hand-scroll crosses the page midpoint, eliminating any delayed settle lags.',
        'Zero Hand-Scroll Resistance: Hand swiping cleanly bypasses programmatic scrollIntoView triggers, allowing lightning-fast consecutive swiping across all views without queuing conflicts.',
      ],
      ar: [
        'مزامنة فورية لشريط التنقل السفلي: مؤشر التبويب النشط وأزرار الشريط السفلي تتحدث لحظياً وفوراً في نفس لحظة تمرير الصفحة باليد بدون أي انتظار لتوقف الحركة.',
        'سلاسة تامة دون مقاومة: السحب باليد يتجاوز التمرير التلقائي بالكامل لضمان سرعة فائقة عند التنقل السريع والمتتالي بين كافة الشاشات.',
      ],
    },
  },
  {
    version: '1.1.52',
    releaseDate: 'October 27, 2026',
    title: {
      en: 'Insights Swipe Unlock, Reliable Bottom Nav Navigation, Home Sidebar Pull & Category Sync',
      ar: 'إلغاء قفل سحب التحليلات، تنقل دقيق بالشريط السفلي، سحب القائمة الجانبية ومزامنة ترتيب الفئات',
    },
    highlights: {
      en: [
        'Insights Horizontal Swipe Unlocked: Removed conflicting touch-pan-y from the insights view, enabling seamless horizontal swiping between Budget, Insights, and Accounts.',
        'Reliable Bottom Nav Transitions: Guaranteed exact page arrival without stopping on intermediate screens, even during extended smooth scrolls or across wide tab jumps.',
        'Home Page Sidebar Pull Gesture: Restored 1:1 tactile edge-pulling on the home page to smoothly draw the sidebar open while preserving native vertical scroll.',
        'Synchronized Category Arrangement: Synchronized custom category ordering from Budget & Categories into the make transaction keypad row and full category directory.',
      ],
      ar: [
        'إلغاء قفل التمرير الأفقي لصفحة التحليلات: إزالة قيود اللمس الرأسي ليتحرك التمرير الأفقي بسلاسة تامة بين الميزانية، التحليلات، والحسابات.',
        'انتقال دقيق عبر الشريط السفلي: وصول مؤكد للصفحة المختارة دون التوقف خطأً على صفحات وسيطة حتى مع التمرير الطويل أو القفز بين التبويبات المتباعدة.',
        'إيماءة سحب القائمة الجانبية من الرئيسية: استعادة سحب القائمة الجانبية 1:1 بالسحب الأفقي من الصفحة الرئيسية مع الحفاظ الكامل على فيزياء التمرير الرأسي.',
        'مزامنة ترتيب الفئات بالكامل: مزامنة الترتيب المخصص للفئات من صفحة الميزانية مباشرة في شريط إضافة المعاملة ودليل الفئات الشامل.',
      ],
    },
  },
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
      ],
      ar: [
        'نظام تراجع عميق متعدد المراحل: زر الرجوع بالهاتف والمتصفح يغلق النوافذ والقوائم المنسدلة تدريجياً وبسلاسة قبل شاشة الخروج.',
        'تتبع حركة الأصبع 1:1: إيماءات سحب أفقية انسيابية تتتبع حركة يدك بدقة بين التبويبات وشاشات الفئات.',
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
