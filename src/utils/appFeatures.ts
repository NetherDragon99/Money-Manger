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
    version: '2.2.6',
    isBeta: true,
    releaseDate: 'November 28, 2026',
    title: {
      en: 'Beta v2.2.6: Auto-Public Link When Adding Friends by 16-Digit Number',
      ar: 'بيتا v2.2.6: فتح الرابط العام تلقائياً عند إضافة صديق برقم الـ 16 خانة',
    },
    highlights: {
      en: [
        'Automatic Public Link on 16-Digit Add: Adding someone by their 16-digit solv number (or choosing a saved friend with one) automatically turns on the public link and syncs the bill right away.',
        'Unified Public Permissions for Everyone: Friends added by 16-digit number follow the exact same public link rules, default guest permissions, read-only settlement lock, and link closure as everyone else.',
      ],
      ar: [
        'تفعيل الرابط العام تلقائياً عند الإضافة برقم الـ 16 خانة: بمجرد إضافة شخص برقمه المكون من 16 خانة (أو اختياره من الأصدقاء المحفوظين)، يتحول شير الفاتورة إلى «رابط عام» ويتزامن فوراً.',
        'نفس قوانين وصلاحيات الرابط العام للجميع: الأشخاص المضافون برقم الـ 16 خانة يخضعون لنفس صلاحيات الضيوف الافتراضية، ووضع القراءة فقط بعد التسوية، وإغلاق الرابط مثل باقي المشاركين.',
      ],
    },
  },
  {
    version: '2.2.5',
    isBeta: true,
    releaseDate: 'November 28, 2026',
    title: {
      en: 'Beta v2.2.5: Reliable Receipt Scan, Unified Public Link & Smart Join Requests',
      ar: 'بيتا v2.2.5: إصلاح مسح الفواتير، رابط عام موحّد وطلبات انضمام ذكية',
    },
    highlights: {
      en: [
        'Fixed Camera Receipt Reading: Scanning receipt photos now extracts items, quantities, prices, and grand total reliably, with higher clarity for long receipts and one-tap retry on the same photo.',
        'All Sharing & Permissions Inside Add Person: Open Add Person to turn on the single Public Link switch, copy or share the link for anyone even without an account, and set guest permissions in one place.',
        'Mandatory Guest Name & Smart Join Linking: Visitors opening your link enter their name first, view the bill read-only until you accept, and you can either add them as new or link them to someone you already added (with easy renaming anytime).',
        'Delete Bill & Automatic Read-Only After Settle: Delete any bill from its header (staying viewable for 24 hours if members joined, or deleting its linked transaction together), and settled bills switch to read-only automatically until reopened.',
      ],
      ar: [
        'إصلاح قراءة الفواتير بالصورة: مسح صور الفواتير يستخرج الأصناف والكميات والأسعار والإجمالي بدقة وسرعة، مع وضوح أعلى للفواتير الطويلة وإعادة المحاولة على نفس الصورة بضغطة واحدة.',
        'كل إعدادات الرابط والصلاحيات داخل إضافة شخص: افتح «إضافة شخص» لتفعيل زرار «رابط عام» الموحّد أو نسخ ومشاركة الرابط لأي شخص حتى من غير حساب وتحديد الصلاحيات في مكان واحد.',
        'طلب الاسم تلقائياً وربط المنضمين بسهولة: أي ضيف يفتح الرابط يكتب اسمه أولاً ويشوف الفاتورة للقراءة فقط لحين موافقتك، وتقدر تضيفه كشخص جديد أو تربطه بشخص كنت ضايفه مع إمكانية تعديل اسمه في أي وقت.',
        'مسح الفاتورة وقراءة فقط تلقائياً بعد التسوية: امسح الفاتورة مباشرة من الشريط العلوي (مع بقاء الرابط متاحاً للعرض 24 ساعة لو فيها أعضاء، أو مسح المعاملة المربوطة معها)، وعند تسوية الفاتورة تتحول للقراءة فقط تلقائياً لحين إعادة فتحها.',
      ],
    },
  },
  {
    version: '2.2.4',
    isBeta: true,
    releaseDate: 'November 27, 2026',
    title: {
      en: 'Beta v2.2.4: Compact Reorderable Items, Live Links & Smart Camera Scan',
      ar: 'بيتا v2.2.4: أصناف مضغوطة قابلة للترتيب، روابط حية، ومسح الفواتير بالكاميرا',
    },
    highlights: {
      en: [
        'Compact Item Rows & Smooth Drag Reordering: Each item now fits on a clean compact line; tap any row to open its full split settings, or long-press and drag to reorder dishes effortlessly.',
        'Exact Split Mode & Direct Quantity Typing: Enter the exact amount each person pays with a live remaining tracker and one-tap Fill Rest, or type exact unit counts directly.',
        'Smart Camera Receipt Scanning: Snap a receipt photo or pick an image to extract dishes, prices, taxes, and grand total automatically, then review before adding.',
        'Live Collaborative Bill Links & Permissions: Share a live link where friends browse view-only by default, pick their own items, or help add dishes—plus safe confirmation before starting a new bill and one-tap Copy Image to clipboard.',
      ],
      ar: [
        'أصناف مضغوطة وترتيب بالسحب السلس: كل صنف يظهر الآن في سطر أنيق مضغوط، وعند الضغط عليه تفتح إعداداته بالكامل، ومع الضغطة الطويلة يمكنك سحبه وإعادة ترتيبه بسلاسة.',
        'وضع المبلغ المحدد وإدخال الكمية مباشرة: اكتب المبلغ الذي يدفعه كل شخص يدوياً مع متابعة المتبقي وزر ملء الباقي بضغطة، أو اكتب عدد الوحدات مباشرة.',
        'مسح الفاتورة بالكاميرا: صوّر الفاتورة أو اخترها من الاستوديو لاستخراج الأصناف والأسعار والضرائب والإجمالي تلقائياً مع مراجعتها قبل الإضافة.',
        'روابط مشاركة حية مع تحكم بالصلاحيات: شارك رابطاً حياً بالوضع الافتراضي للعرض فقط أو السماح باختيار الطلبات أو المساعدة في الإضافة، مع حماية المسودة عند بدء فاتورة جديدة ونسخ صورة الفاتورة مباشرة.',
      ],
    },
  },
  {
    version: '2.2.3',
    isBeta: true,
    releaseDate: 'November 27, 2026',
    title: {
      en: 'Beta v2.2.3: Clean Per-Tab Headers & Visible Bill Split Icon',
      ar: 'بيتا v2.2.3: إصلاح تداخل الهيدر وإظهار أيقونة لمّ الحساب',
    },
    highlights: {
      en: [
        'Each Tab Shows Its Own Header: Fixed the top bar sticking on Accounts while browsing Home, Budget, or Insights so every page displays its own title and buttons cleanly.',
        'Always-Visible Bill Split Button: The receipt icon in the Home header now appears right beside the reset button with zero overlap, keeping the solv brand mark clean.',
      ],
      ar: [
        'هيدر مستقل لكل صفحة: تم إصلاح تداخل الشريط العلوي الذي كان يُظهر عنوان «الحسابات» فوق الرئيسية والميزانية والتحليلات، فأصبحت كل صفحة تعرض عنوانها وأزرارها بشكل صحيح.',
        'ظهور أيقونة لمّ الحساب بوضوح: أيقونة الفاتورة في الشريط العلوي للرئيسية أصبحت ظاهرة بوضوح بجانب زر إعادة الضبط مع بقاء شعار solv نظيفاً.',
      ],
    },
  },
  {
    version: '2.2.2',
    isBeta: true,
    releaseDate: 'November 26, 2026',
    title: {
      en: 'Beta v2.2.2: Group Bill Splitting & Smart Receipt Sharing',
      ar: 'بيتا v2.2.2: صفحة لمّ الحساب وتقسيم الفواتير بالكامل',
    },
    highlights: {
      en: [
        'Full Bill Split Page: Tap the new receipt button in the Home header to enter ordered dishes, quantities, and people in seconds — works smoothly even without internet.',
        'Smart Taxes, Fees & Exemptions: Add service charges, tax, delivery, tips, or discounts in any order, split proportionally or equally, exempt specific people, or pin a fixed amount for anyone.',
        'Automatic Bill Total Check: Enter the printed receipt total to spot missing fees, rounding cents, or extra items right away with clear explanations and quick fix buttons.',
        'Paste Receipt Text & Saved Groups: Paste restaurant order text in Arabic or English to fill items automatically, reuse saved friends and groups in one tap, and keep unfinished drafts safe.',
        'Share as Dark or Light Image & Link to Your Account: Share clean receipt cards or messages for the whole bill, chosen people, or each friend separately with transfer details, and reopen any bill directly from its saved transaction.',
      ],
      ar: [
        'صفحة لمّ الحساب وتقسيم الفواتير: اضغط على أيقونة الفاتورة الجديدة في الشريط العلوي للرئيسية لإضافة الأصناف والكميات والناس بسرعة فائقة وبدون الحاجة لإنترنت.',
        'ضريبة وخدمة وخصومات بمرونة كاملة: أضف الخدمة والضريبة والتوصيل والبخشيش والخصم بأي ترتيب، مع إمكانية إعفاء أشخاص محددين أو تحديد مبلغ ثابت لأي شخص.',
        'مطابقة ذكية لإجمالي الفاتورة: اكتب الإجمالي المكتوب على الفاتورة والنظام يكتشف لك أي فرق أو نسبة ناقصة أو فكة تقريب ويديك حلول جاهزة بضغطة واحدة.',
        'لصق الفاتورة ومجموعات الصحاب: الصق نص الفاتورة بالعربي أو الإنجليزي لتوزيع الأصناف تلقائياً، واحفظ مجموعات صحابك ومسوداتك وسجل الفواتير السابقة.',
        'مشاركة كصورة داكنة أو فاتحة وربط بحسابك: ابعت الفاتورة كلها أو حساب كل شخص لوحده كصورة أنيقة أو رسالة شاملة بيانات التحويل، وسجل اللي دفعته كمعاملة تقدر ترجع تفتح منها صفحة الحساب في أي وقت.',
      ],
    },
  },
  {
    version: '2.2.1',
    isBeta: true,
    releaseDate: 'November 26, 2026',
    title: {
      en: 'Beta v2.2.1: Sleek Single-Line Transfer Cards',
      ar: 'بيتا v2.2.1: بطاقات تحويل مدمجة وأنيقة في سطر واحد',
    },
    highlights: {
      en: [
        'Single-Line Transfer Layout: Transfers between accounts now sit cleanly on a single horizontal row (From ➔ To) without taking excessive vertical space.',
        'Smart Icon Fallback: On mobile screens or when account names are long, the card shows the account icons with From/To tags to prevent multi-line clutter while keeping full names visible on wider screens.',
      ],
      ar: [
        'تصميم مدمج للتحويلات في سطر واحد: معاملات التحويل بين الحسابات أصبحت تظهر بشكل أفقي أنيق ومريح للعين (من ➔ إلى) دون أن تأخذ أسطر متعددة أو تزدحم الشاشة.',
        'اقتصار ذكي على الأيقونات: في الشاشات الصغيرة أو عند طول أسماء الحسابات، يكتفي الكارت بإظهار أيقونات الحسابات مع وسوم (من / إلى) لمنع الزحمة، مع عرض الأسماء كاملة على الشاشات الأكبر.',
      ],
    },
  },
  {
    version: '2.2.0',
    isBeta: false,
    releaseDate: 'November 24, 2026',
    title: {
      en: 'Version 2.2.0: solv Official Major Release',
      ar: 'إصدار 2.2.0 الرسمي: التحديث الشامل لتطبيق solv',
    },
    highlights: {
      en: [
        'Welcome to solv: Fresh app name, sleek green-mint icon, and refined dark theme across every screen.',
        'Always-Ready Offline Access: Opens reliably without internet, keeps your account signed in automatically, installs in one tap, and keeps beta testing cleanly separated.',
        'Smarter Cycle & Live Income Rebalancing: Collapse cycle settings cleanly, automatically rebalance your daily limit when adding income to public accounts, and adjust seamlessly if moved to private.',
        'Manual Budget Adjustments & One-Off Tracker: Fine-tune progress inside each budget pool independently without shifting your daily limit, and track one-off purchases directly.',
        'Deeper Future-Impact & Three-Mode What-If Lab: Preview exact daily and monthly consequences before saving any transaction or testing single, multi-day, and extra-income plans.',
        'Unified Period Picker & Smart Filters: Pick built-in durations or a custom calendar range, filter by active categories, price slider, sorting, and extra flags on both Home and Account pages.',
        'Stable Typing & Ultra-Smooth Scrolling: The screen stays steady when opening the keyboard, and transaction lists glide smoothly even with large histories.',
        'Clean App Name Everywhere: The app always appears simply as "solv" on your home screen, browser tab, and during installation — the Beta badge now appears only beside the version number.',
        'Cleaner Switching Between Official & Beta: Opening either version automatically clears leftovers from the other so you always see the latest screens right away.',
        'One-Off & Outings Protection: Spending on one-off purchases or outings no longer shrinks today\'s Spent Today counter or sends today negative — any excess spreads calmly across your remaining days.',
        'Live Balance Obligation Math: Your daily limit now checks your actual cash across selected accounts, reserves remaining unpaid bills and savings first, and divides what is truly left fairly over the rest of the month.',
        'Always-Ready Account Selector: Pick exactly which accounts count in Smart Budget right under your cycle settings with quick buttons for Public Only, Private Only, and All accounts.',
        'Accurate Pool Percentages: Each budget card percentage now reflects your live updated budget total (including extra income) so all shares always add up to 100%.',
        'Safe Notch Spacing: Top headers, drawers, and alerts now sit comfortably below phone camera notches and curved top bars so every button stays easy to tap.',
        'Revamped Light, Dark & System Themes: Crisp daylight colors across every card, chart, and pop-up window, plus an automatic option that follows your device look.',
        'Dedicated Budget Message Language: Choose under Settings whether smart budget advice speaks in lively Egyptian Arabic, plain English, or follows your main app language.',
        'Clearer Expense Impact Cards: Full impact titles and notes are always readable with zero cut-off text, organized into simple everyday highlights with optional detailed numbers underneath.',
        'Accurate Budget Status Badges: The sidebar now shows a red alert only for a real budget shortfall, a calm yellow heads-up when spending dips near your limit, and stays clean green when everything is balanced — with a clear explanation right inside the budget screen.',
        'Custom In-App Notification Timing: Choose how long on-screen notifications stay visible from 3 to 15 seconds with quick presets, a 5-second default, at least 7 seconds for important action buttons, or keep them open until you close them manually.',
        'Honest 7-Day Pace Forecast: Impact cards now measure your recent daily pace without mixing in outings, show clearly how many days your remaining money will last, and fix number direction in both Arabic and English.',
        'Stretch Extra Days in What-If Lab: Test how your current cash stretches if payday is delayed by extra days, and apply that extension to the current cycle as a one-off exception without affecting next month.',
      ],
      ar: [
        'أهلاً بك في solv: اسم جديد وأيقونة خضراء أنيقة مع لمسات بصرية مريحة للعين في كل الشاشات.',
        'عمل موثوق بدون إنترنت: يفتح التطبيق مباشرة في كل مرة مع بقاء حسابك مسجلاً، وتثبيت مباشر بضغطة واحدة، وفصل كامل لنسخة البيتا التجريبية.',
        'إعادة ترتيب ذكية مع الدخل: إعدادات دورة قابلة للطي، وتعديل تلقائي للمصروف اليومي عند إضافة دخل للحسابات العامة أو نقله لحساب خاص.',
        'تحكم يدوي بكل حوض ومصروف الطوارئ: عدّل تقدم التحويش والفواتير والخروجات ومصروف الطوارئ يدوياً وبشكل منفصل دون تغيير مصروفك اليومي، مع متابعة مباشرة لبند المشتريات غير المتكررة.',
        'تحليل أعمق وتجربة سيناريوهات متعددة: اعرف تأثير أي معاملة على بقية الشهر قبل الحفظ، وجرب خطط مصروف ليوم أو لعدة أيام أو دخل إضافي.',
        'فلتر موحد للمدة وخيارات بحث دقيقة: اختر المدة أو حدد تاريخين من التقويم، مع فلاتر للفئات المستخدمة فقط وسلايدر للأسعار والترتيب في الرئيسية وداخل كل حساب.',
        'ثبات أثناء الكتابة وسلاسة فائقة: ثبات تام للشاشة عند فتح لوحة المفاتيح مع تمرير فائق السرعة وخفيف جداً على الجهاز.',
        'اسم نظيف للتطبيق في كل مكان: بيظهر التطبيق دايماً باسم "solv" بس على الشاشة الرئيسية وعند التثبيت، وكلمة Beta بتظهر بس جنب رقم الإصدار.',
        'تبديل أنظف بين النسخة الرسمية والبيتا: أول ما تفتح أي نسخة بتمسح بقايا النسخة التانية تلقائياً عشان تشوف آخر التحديثات على طول.',
        'حماية مصروفك اليومي: المصاريف الاستثنائية والخروجات لم تعد تتخصم من خانة مصروف النهاردة ولا تخلي يومك بالسالب — ولو في أي زيادة بتتوزع بهدوء على باقي أيام الشهر.',
        'مراجعة حية لفلوس حساباتك: التطبيق بيحسب الفلوس الموجودة فعلاً في الحسابات اللي اخترتها، ويحجز منها الأول التزامات الفواتير والتحويش اللي لسه ما خلصتش، والباقي الصافي بيتقسم على الأيام المتبقية.',
        'اختيار الحسابات واختصارات سريعة دايماً تحت إيدك: تقدر تفتح قائمة الحسابات الداخلة في الميزانية مباشرة تحت الدورة مع أزرار سريعة لاختيار العامة فقط، الخاصة فقط، أو الكل.',
        'نسب مئوية مضبوطة 100%: نسب كل بند بقت بتتحسب صح من إجمالي ميزانيتك الحية شاملة أي دخل إضافي.',
        'مساحة أمان لحواف التليفونات: الهيدر العلوي والقوائم والتنبيهات بقوا يبدأوا تحت النوتش والكاميرا الأمامية بوضوح عشان كل زرار يفضل سهل في الضغطة.',
        'إعادة هيكلة كاملة للوضع الفاتح والداكن والتلقائي: ألوان فاتحة مريحة ومتناسقة في كل الكروت والرسوم البيانية، مع اختيار تلقائي يمشي ورا مظهر موبايلك.',
        'لغة مستقلة لرسائل الميزانية: من الإعدادات تقدر تختار أسلوب ونبرة نصائح الميزانية لوحدها بين المصري الودود أو الإنجليزي البسيط أو لغة التطبيق الأساسية.',
        'رسائل تأثير المصاريف أوضح ومن غير قص: الكلام كامل ظاهر من غير نقط مقصوصة، ومتقسّم لبساطة سريعة في الأول مع زرار اختياري لو حابب تشوف الأرقام التفصيلية.',
        'شارات حالة أدق للميزانية: القائمة الجانبية بتعرض تنبيه أحمر فقط عند وجود عجز فعلي، وتنبيه أصفر هادئ عند الاقتراب من الحد، وتفضل خضراء طالما الميزانية مستقرة — مع توضيح واضح للسبب مباشرة داخل الميزانية.',
        'تحكم كامل في مدة الإشعارات داخل التطبيق: اختار مدة بقاء الإشعارات من 3 لـ 15 ثانية عبر أزرار سريعة أو شريط تمرير بافتراضي 5 ثواني، وضمان 7 ثواني على الأقل للإشعارات المهمة، مع خيار إغلاق يدوي فقط.',
        'تنبؤ صادق بمعدل آخر 7 أيام: كارت تأثير المعاملة بيحسب وتيرة صرفك اليومي فقط بدون خلط الخروجات، ويوضحلك فلوسك تكفي كام يوم قدام بدون أي عجز وهمي مع ضبط اتجاه الأرقام في العربي والإنجليزي.',
        'تمديد أيام إضافية في محاكي ماذا لو: اختبر لو حبيت تقعد أيام زيادة بالفلوس اللي معاك بس، وطبّق التمديد فعلياً على الشهر ده كحالة استثنائية من غير ما يأثر على الشهور الجاية.',
      ],
    },
  },
  {
    version: '2.0.5',
    isBeta: true,
    rolledUpInto: '2.2.0',
    releaseDate: 'November 24, 2026',
    title: {
      en: 'Version 2.0.5 Beta: Accurate Budget Status Badges & Custom Notification Timing',
      ar: 'إصدار 2.0.5 التجريبي: شارات ميزانية أدق وتحكم كامل في مدة الإشعارات',
    },
    highlights: {
      en: [
        'Accurate Budget Status Badges: The sidebar now shows a red alert only for a real budget shortfall, a calm yellow heads-up when spending dips near your limit, and stays clean green when everything is balanced — with a clear explanation right inside the budget screen.',
        'Custom In-App Notification Timing: Choose how long on-screen notifications stay visible from 3 to 15 seconds with quick presets, a 5-second default, at least 7 seconds for important action buttons, or keep them open until you close them manually.',
        'Honest 7-Day Pace Forecast: Impact cards now measure your recent daily pace without mixing in outings, show clearly how many days your remaining money will last, and fix number direction in both Arabic and English.',
        'Stretch Extra Days in What-If Lab: Test how your current cash stretches if payday is delayed by extra days, and apply that extension to the current cycle as a one-off exception without affecting next month.',
      ],
      ar: [
        'شارات حالة أدق للميزانية: القائمة الجانبية بتعرض تنبيه أحمر فقط عند وجود عجز فعلي، وتنبيه أصفر هادئ عند الاقتراب من الحد، وتفضل خضراء طالما الميزانية مستقرة — مع توضيح واضح للسبب مباشرة داخل الميزانية.',
        'تحكم كامل في مدة الإشعارات داخل التطبيق: اختار مدة بقاء الإشعارات من 3 لـ 15 ثانية عبر أزرار سريعة أو شريط تمرير بافتراضي 5 ثواني، وضمان 7 ثواني على الأقل للإشعارات المهمة، مع خيار إغلاق يدوي فقط.',
      ],
    },
  },
  {
    version: '2.0.4',
    isBeta: true,
    rolledUpInto: '2.2.0',
    releaseDate: 'November 24, 2026',
    title: {
      en: 'Version 2.0.4 Beta: Friendly Budget Messages, Full Light Theme & Notch Protection',
      ar: 'إصدار 2.0.4 التجريبي: رسائل ميزانية بالعامية المصرية، مظهر فاتح متكامل وحماية لحواف الشاشة',
    },
    highlights: {
      en: [
        'Safe Notch Spacing: Top headers, drawers, and alerts now sit comfortably below phone camera notches and curved top bars so every button stays easy to tap.',
        'Revamped Light, Dark & System Themes: Crisp daylight colors across every card, chart, and pop-up window, plus an automatic option that follows your device look.',
        'Dedicated Budget Message Language: Choose under Settings whether smart budget advice speaks in lively Egyptian Arabic, plain English, or follows your main app language.',
        'Clearer Expense Impact Cards: Full impact titles and notes are always readable with zero cut-off text, organized into simple everyday highlights with optional detailed numbers underneath.',
      ],
      ar: [
        'مساحة أمان لحواف التليفونات: الهيدر العلوي والقوائم والتنبيهات بقوا يبدأوا تحت النوتش والكاميرا الأمامية بوضوح عشان كل زرار يفضل سهل في الضغطة.',
        'إعادة هيكلة كاملة للوضع الفاتح والداكن والتلقائي: ألوان فاتحة مريحة ومتناسقة في كل الكروت والرسوم البيانية، مع اختيار تلقائي يمشي ورا مظهر موبايلك.',
        'لغة مستقلة لرسائل الميزانية: من الإعدادات تقدر تختار أسلوب ونبرة نصائح الميزانية لوحدها بين المصري الودود أو الإنجليزي البسيط أو لغة التطبيق الأساسية.',
        'رسائل تأثير المصاريف أوضح ومن غير قص: الكلام كامل ظاهر من غير نقط مقصوصة، ومتقسّم لبساطة سريعة في الأول مع زرار اختياري لو حابب تشوف الأرقام التفصيلية.',
      ],
    },
  },
  {
    version: '2.0.3',
    isBeta: true,
    rolledUpInto: '2.2.0',
    releaseDate: 'November 22, 2026',
    title: {
      en: 'Version 2.0.3 Beta: Smarter Daily Allowance, Live Balance Math & Account Shortcuts',
      ar: 'إصدار 2.0.3 التجريبي: حساب أدق للمصروف اليومي وأرصدة الحسابات واختصارات أسرع',
    },
    highlights: {
      en: [
        'One-Off & Outings Protection: Spending on one-off purchases or outings no longer shrinks today\'s Spent Today counter or sends today negative — any excess spreads calmly across your remaining days.',
        'Live Balance Obligation Math: Your daily limit now checks your actual cash across selected accounts, reserves remaining unpaid bills and savings first, and divides what is truly left fairly over the rest of the month.',
        'Always-Ready Account Selector: Pick exactly which accounts count in Smart Budget right under your cycle settings with quick buttons for Public Only, Private Only, and All accounts.',
        'Accurate Pool Percentages: Each budget card percentage now reflects your live updated budget total (including extra income) so all shares always add up to 100%.',
      ],
      ar: [
        'حماية مصروفك اليومي: المصاريف الاستثنائية والخروجات لم تعد تتخصم من خانة مصروف النهاردة ولا تخلي يومك بالسالب — ولو في أي زيادة بتتوزع بهدوء على باقي أيام الشهر.',
        'مراجعة حية لفلوس حساباتك: التطبيق بيحسب الفلوس الموجودة فعلاً في الحسابات اللي اخترتها، ويحجز منها الأول التزامات الفواتير والتحويش اللي لسه ما خلصتش، والباقي الصافي بيتقسم على الأيام المتبقية.',
        'اختيار الحسابات واختصارات سريعة دايماً تحت إيدك: تقدر تفتح قائمة الحسابات الداخلة في الميزانية مباشرة تحت الدورة مع أزرار سريعة لاختيار العامة فقط، الخاصة فقط، أو الكل.',
        'نسب مئوية مضبوطة 100%: نسب كل بند بقت بتتحسب صح من إجمالي ميزانيتك الحية شاملة أي دخل إضافي.',
      ],
    },
  },
  {
    version: '2.0.2',
    isBeta: true,
    rolledUpInto: '2.2.0',
    releaseDate: 'November 21, 2026',
    title: {
      en: 'Version 2.0.2 Beta: Cleaner App Name & Smoother Channel Switching',
      ar: 'إصدار 2.0.2 التجريبي: اسم أنظف للتطبيق وتبديل أسهل بين النسخ',
    },
    highlights: {
      en: [
        'Clean App Name Everywhere: The app always appears simply as "solv" on your home screen, browser tab, and during installation — the Beta badge now appears only beside the version number.',
        'Cleaner Switching Between Official & Beta: Opening either version automatically clears leftovers from the other so you always see the latest screens right away.',
      ],
      ar: [
        'اسم نظيف للتطبيق في كل مكان: بيظهر التطبيق دايماً باسم "solv" بس على الشاشة الرئيسية وعند التثبيت، وكلمة Beta بتظهر بس جنب رقم الإصدار.',
        'تبديل أنظف بين النسخة الرسمية والبيتا: أول ما تفتح أي نسخة بتمسح بقايا النسخة التانية تلقائياً عشان تشوف آخر التحديثات على طول.',
      ],
    },
  },
  {
    version: '2.0.1',
    isBeta: true,
    rolledUpInto: '2.2.0',
    releaseDate: 'November 21, 2026',
    title: {
      en: 'Version 2.0.1 Beta: Welcome to solv, Smarter Budget Control & Effortless Speed',
      ar: 'إصدار 2.0.1 التجريبي: هوية solv الجديدة، تحكم أذكى بالميزانية وسلاسة فائقة',
    },
    highlights: {
      en: [
        'Welcome to solv: Fresh app name, sleek green-mint icon, and refined dark theme across every screen.',
        'Always-Ready Offline Access: Opens reliably without internet, keeps your account signed in automatically, installs in one tap, and keeps beta testing cleanly separated.',
        'Smarter Cycle & Live Income Rebalancing: Collapse cycle settings cleanly, automatically rebalance your daily limit when adding income to public accounts, and adjust seamlessly if moved to private.',
        'Manual Budget Adjustments & One-Off Tracker: Fine-tune progress inside each budget pool independently without shifting your daily limit, and track one-off purchases directly.',
        'Deeper Future-Impact & Three-Mode What-If Lab: Preview exact daily and monthly consequences before saving any transaction or testing single, multi-day, and extra-income plans.',
        'Unified Period Picker & Smart Filters: Pick built-in durations or a custom calendar range, filter by active categories, price slider, sorting, and extra flags on both Home and Account pages.',
        'Stable Typing & Ultra-Smooth Scrolling: The screen stays steady when opening the keyboard, and transaction lists glide smoothly even with large histories.',
      ],
      ar: [
        'أهلاً بك في solv: اسم جديد وأيقونة خضراء أنيقة مع لمسات بصرية مريحة للعين في كل الشاشات.',
        'عمل موثوق بدون إنترنت: يفتح التطبيق مباشرة في كل مرة مع بقاء حسابك مسجلاً، وتثبيت مباشر بضغطة واحدة، وفصل كامل لنسخة البيتا التجريبية.',
        'إعادة ترتيب ذكية مع الدخل: إعدادات دورة قابلة للطي، وتعديل تلقائي للمصروف اليومي عند إضافة دخل للحسابات العامة أو نقله لحساب خاص.',
        'تحكم يدوي بكل حوض ومصروف الطوارئ: عدّل تقدم التحويش والفواتير والخروجات ومصروف الطوارئ يدوياً وبشكل منفصل دون تغيير مصروفك اليومي، مع متابعة مباشرة لبند المشتريات غير المتكررة.',
        'تحليل أعمق وتجربة سيناريوهات متعددة: اعرف تأثير أي معاملة على بقية الشهر قبل الحفظ، وجرب خطط مصروف ليوم أو لعدة أيام أو دخل إضافي.',
        'فلتر موحد للمدة وخيارات بحث دقيقة: اختر المدة أو حدد تاريخين من التقويم، مع فلاتر للفئات المستخدمة فقط وسلايدر للأسعار والترتيب في الرئيسية وداخل كل حساب.',
        'ثبات أثناء الكتابة وسلاسة فائقة: ثبات تام للشاشة عند فتح لوحة المفاتيح مع تمرير فائق السرعة وخفيف جداً على الجهاز.',
      ],
    },
  },
  {
    version: '2.0.0',
    isBeta: false,
    releaseDate: 'November 8, 2026',
    title: {
      en: 'Version 2.0.0 Major Update: Smart Budget Overhaul, 100% Local Math Engine & Offline PWA',
      ar: 'التحديث الشامل للإصدار 2.0.0: إعادة هيكلة الميزانية الذكية، محرك حسابات محلي 100% وموثوقية تامة بدون إنترنت',
    },
    highlights: {
      en: [
        'Unified Smart Budget Hub: A seamless vertical experience merging live daily allowance tracking, customizable cycle start dates, and 4-pool financial allocations',
        'Deterministic Local Math Engine: Eradicated experimental external services in favor of 100% private, instant, and deterministic financial calculations',
        'Absolute Currency Allocations: Set exact fixed amounts for Savings, Bills, and Outings with automatic calculation of your remaining daily allowance',
        'Interactive Budget Pool Cards: Tap any budget pool card to view, inspect, and manage its tagged transactions for the active cycle',
        'Accurate Savings Tracking: Automatic progress bar and live total updates capturing all savings transfers and tagged allocations',
        'Full Offline PWA Reliability: Uninterrupted offline access to all accounts, transactions, and analytics with instant background syncing',
        'Restored Home & Filter Controls: Quick-access date range selectors, comprehensive filter funnels, and active filter badges',
        'Flexible Transaction Fees & Taxes: Easily add taxes, commissions, or percent-based charges with an auto-expanding notes area',
      ],
      ar: [
        'واجهة موحدة للميزانية الذكية: تجربة عمودية متكاملة تجمع متتبع المصروف اليومي الحي، وتواريخ بداية مرنة للدورة، وإدارة أحواض الميزانية الأربعة',
        'محرك حسابات محلي وحتمي 100%: استبعاد كافة الاعتماديات الخارجية لضمان خصوصية مطلقة وحسابات مالية فورية وحتمية دون اتصال بالإنترنت',
        'توزيع نقد دقيق بالمبالغ: تحديد مبالغ ثابتة لأحواض الادخار والفواتير والخروجات مع حساب فوري لمصروفك اليومي المتبقي',
        'أحواض ميزانية تفاعلية: إمكانية النقر على أي حوض ميزانية لعرض كافة المعاملات المرتبطة به خلال الدورة الحالية وتفاصيلها',
        'تتبع دقيق للمدخرات: تحديث تلقائي لشريط التقدم وإجمالي المبالغ المحوشة لكل تحويلات وتخصيصات الادخار',
        'موثوقية كاملة بدون إنترنت: استخدام سلس لجميع الحسابات والمعاملات والأدوات أوفلاين مع مزامنة فورية عند الاتصال',
        'فلاتر رئيسية وتحكم متطور: محدد نطاق زمني شامل وفلتر متقدم مع شارات الفلاتر النشطة وخيار إعادة الضبط السريع',
        'حساب مرن للرسوم والضرائب: إضافة الضرائب ورسوم التحويل كنسبة مئوية أو مبلغ ثابت مع مساحة ملاحظات واسعة',
      ],
    },
  },
  {
    version: '1.2.2',
    isBeta: true,
    rolledUpInto: '2.0.0',
    releaseDate: 'November 8, 2026',
    title: {
      en: 'Home Filters, Budget Cycle Modes, Savings Tracking & Pool Details',
      ar: 'فلاتر الرئيسية ودورات الميزانية وتتبع التحويش وتفاصيل الأحواض',
    },
    highlights: {
      en: [
        'Restored Home filters: Complete date range selector (Today, This Week, Cycle, Calendar Month, Custom, All Time) and advanced filter funnel with active filter badges and quick reset',
        'Flexible budget cycle start: Choose between App Default Month, Calendar Month, Live From Today, or a custom start day and date',
        'Instant Apply action: Sticky button to save and apply your budget configurations with real-time recalculations',
        'Accurate savings tracking: Fixed savings progress bar and totals to automatically capture and reflect all savings transfers and allocations',
        'Interactive budget pool cards: Tap any pool card to inspect all tagged transactions for the current cycle with instant detail view',
      ],
      ar: [
        'استعادة فلاتر الصفحة الرئيسية: محدد نطاق زمني شامل وفلتر متقدم مع شارات الفلاتر النشطة وخيار إعادة الضبط السريع',
        'خيارات مرنة لبداية دورة الميزانية: الاختيار بين شهر التطبيق الافتراضي أو الشهر الميلادي أو المتابعة من اليوم أو تحديد يوم وتاريخ مخصص',
        'تطبيق وحفظ فوري: زر مثبت لتطبيق وحفظ تغييرات الميزانية وإعادة الحساب فورياً',
        'تتبع دقيق للمدخرات: إصلاح شريط تقدم التحويش لحساب كافة تحويلات وتخصيصات الادخار بشكل فوري وصحيح',
        'أحواض ميزانية تفاعلية: إمكانية الضغط على أي حوض ميزانية لعرض كافة المعاملات المرتبطة به خلال الدورة الحالية مع إمكانية تعديلها',
      ],
    },
  },
  {
    version: '1.2.1',
    isBeta: true,
    rolledUpInto: '2.0.0',
    releaseDate: 'November 8, 2026',
    title: {
      en: 'Unified Smart Budget View & 100% Local Math Engine',
      ar: 'واجهة موحدة للميزانية الذكية ومحرك حسابات محلي 100%',
    },
    highlights: {
      en: [
        'Unified vertical Smart Budget: Merged tabbed views into a single seamless vertical layout combining global settings, daily allowance tracker, live pool progress, and rebalance tools',
        'Complete removal of experimental AI features: Eradicated all external AI dependencies to guarantee 100% offline, private, and deterministic financial calculations',
        'Single centralized save: One "Save Budget Plan" button persists your entire budget configuration and rules instantly',
        'Live pool tracking: Real-time spending and remaining balances for Savings, Bills, Outings, and Daily Spending',
      ],
      ar: [
        'واجهة موحدة للميزانية الذكية: دمج التبويبات في واجهة عمودية واحدة تجمع الإعدادات العامة ومتتبع المصروف اليومي وتقدم الأحواض وأدوات إعادة التوازن',
        'إزالة كاملة للذكاء الاصطناعي التجريبي: حذف كافة الاعتماديات الخارجية لضمان خصوصية وحسابات مالية محلية وحتمية 100% بدون إنترنت',
        'زر حفظ موحد: زر "حفظ خطة الميزانية" لحفظ كافة إعدادات وتوزيعات الميزانية بنقرة واحدة',
        'متابعة حية لأحواض الميزانية: عرض فوري ومباشر للمصروف والمتبقي في أحواض التحويش والفواتير والخروجات والمصروف اليومي',
      ],
    },
  },
  {
    version: '1.2.0',
    isBeta: true,
    rolledUpInto: '2.0.0',
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
    rolledUpInto: '2.0.0',
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
      en: 'Install solv directly on your phone home screen as a standalone application. It launches instantly in full screen with no browser address bar or search header, and functions at lightning speed even in airplane mode with complete local storage.',
      ar: 'قم بتثبيت التطبيق مباشرة على شاشة هاتفك الرئيسية ليعمل كتطبيق مستقل بملء الشاشة دون شريط عناوين المتصفح. يفتح التطبيق بسرعة فائقة ويعمل بكفاءة كاملة حتى في وضع الطيران بدون أي اتصال بالإنترنت بفضل التخزين المحلي الشامل.',
    },
    whereToFind: {
      en: 'Side Menu (☰) → Tap "Install App" button, or browser menu → "Add to Home screen" / "Install".',
      ar: 'القائمة الجانبية (☰) ← اضغط على زر "تثبيت التطبيق"، أو خيارات المتصفح ← "إضافة إلى الشاشة الرئيسية".',
    },
    howToUse: {
      en: [
        'In your mobile browser (Chrome on Android or Safari on iPhone), look for the "Install App" prompt.',
        'Alternatively, open the side menu (☰) and tap "Install App" to launch the native installation dialog.',
        'Confirm the installation prompt to add the application icon directly to your Home Screen.',
        'Launch solv from your phone screen to enjoy an immersive, full-screen standalone experience.',
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
  {
    id: 'bill-split',
    icon: '🧾',
    category: 'finance',
    title: {
      en: 'Group Bill Split & Receipt Sharing',
      ar: 'لمّ الحساب وتقسيم الفواتير',
    },
    subtitle: {
      en: 'Split group tabs with taxes, checks & image cards',
      ar: 'قسّم فاتورة الشلة بالضريبة والمطابقة وصور جاهزة للمشاركة',
    },
    description: {
      en: 'Manage restaurant meals, group outings, and shared orders effortlessly. Enter items with unit quantities or paste receipt text directly, configure flexible service/tax/delivery/discount rules with per-person exemptions, check your total against the printed bill, mark who paid, share dark or light receipt cards per person, and record your payment as a linked expense transaction.',
      ar: 'نظّم حسابات المطاعم والخروجات والطلبات المشتركة بكل سهولة. أضف الأصناف والكميات أو الصق نص الفاتورة، اضبط الخدمة والضريبة والتوصيل والخصم مع إعفاء أو تثبيت مبلغ لأشخاص محددين، طابق الإجمالي المكتوب، علّم من دفع، شارك صور فاتورة داكنة أو فاتحة لكل شخص، وسجّل ما دفعته كمعاملة مرتبطة يمكنك الرجوع إليها في أي وقت.',
    },
    whereToFind: {
      en: 'Home Screen → Tap the Receipt Icon in the top-right header bar beside the Reset button.',
      ar: 'الشاشة الرئيسية ← اضغط على أيقونة الفاتورة في الشريط العلوي بجانب زر إعادة الضبط.',
    },
    howToUse: {
      en: [
        'Add people by name, from your saved friends, or using one-tap friend groups.',
        'Add items quickly or paste receipt text, then tap people to split equally, share with everyone, or assign exact units.',
        'Add service, tax, delivery, or discounts and enter the written receipt total so solv verifies every cent.',
        'Mark who paid, share Dark or Light receipt images or individual messages, and tap Done to record your expense.',
      ],
      ar: [
        'أضف الأشخاص بالاسم أو من الأصدقاء المحفوظين أو المجموعات الجاهزة بضغطة واحدة.',
        'أضف الأصناف بسرعة أو الصق نص الفاتورة، ثم اضغط على الأسماء للتقسيم العادل أو للكل أو حسب الوحدات.',
        'أضف الخدمة والضريبة والتوصيل والخصم واكتب الإجمالي المطبوع للتأكد من عدم وجود أي فرق.',
        'علّم على من دفع، وشارك صور داكنة أو فاتحة أو رسائل لكل شخص منفصل، ثم اضغط تم لتسجيل المصروف.',
      ],
    },
    proTip: {
      en: 'You can reopen any saved Bill Split directly from its transaction details or edit screen whenever someone pays later.',
      ar: 'تقدر تفتح صفحة أي حساب مقسّم تاني مباشرة من شاشة تفاصيل أو تعديل المعاملة لو حد دفع لاحقاً أو حبيت تعدل حاجة.',
    },
  },
];
