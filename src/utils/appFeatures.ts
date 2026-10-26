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
    version: '1.1.47',
    releaseDate: 'October 26, 2026',
    title: {
      en: 'Hardened 4-Stage Sign-In Gate, V4 Flat Granular Timestamp Sync, Lossless Offline Dirty Queue & Sidebar Sync Indicator',
      ar: 'بوابة تسجيل الدخول الصارمة ذات الـ 4 مراحل، المزامنة الدقيقة المسطحة v4، طابور التعديلات بدون إنترنت ومؤشر المزامنة في القائمة الجانبية',
    },
    highlights: {
      en: [
        'Strict 4-Stage Sign-In Decision Gate: Complete freeze on sign-in from a new device or re-login; inspects cloud data before syncing and engages an interactive Replace vs. Merge decision modal when both local and cloud data exist.',
        'Flat Rule-Compliant V4 Node Structure: Replaced deep nestings with flat nodes (g_manifest_uid, g_uid_transactions, _accounts, _categories, _recurring, _budgets, _tombstones) and safely purged obsolete legacy nodes after verified count checks.',
        'Lossless Offline Granular Dirty Queue: Automatically tracks all offline item edits and deletions in mm_granular_v4_dirty_queue, coalesces per item, writes tombstones before item removals, and flushes losslessly upon reconnect only after write confirmation.',
        'Subtle Sidebar Sync Indicator: Clean, non-intrusive live status indicator inside the Sidebar showing live status (Syncing, Synced with HH:MM timestamp, Offline, Awaiting choice) with zero intrusive popup banners.',
        'Live Member Profile Sync & Real-Time Share Propagation: Non-destructive update() for user profile cards, live onValue profile hooks for shared spaces, and automatic cross-view propagation of HomeView transactions into linked shared spaces.',
        'Standalone PWA WebAPK Installation: Unified single manifest in VitePWA with discrete "any" and "maskable" icons, immediate early prompt capture, and zero fake download shortcuts.',
        'Multi-Line Toast Notifications & Arabic-Normalized Search: Responsive notification wrap with scaled auto-dismiss timing, and complete normalization of Arabic diacritics/letter variants for transaction comment and note searches.',
      ],
      ar: [
        'بوابة تسجيل الدخول الصارمة ذات الـ 4 مراحل: تجميد كامل عند تسجيل الدخول من جهاز جديد أو إعادة الدخول لفحص السحابة وعرض نافذة الاستبدال أو الدمج إذا توفرت بيانات على الجهاز والسحابة معاً.',
        'بنية العقد المسطحة v4 المتوافقة مع القواعد: استبدال التفرعات العميقة بعقد مسطحة منفصلة (المعاملات، الحسابات، التصنيفات، التكرار، الميزانيات، شواهد الحذف) مع الحذف الآمن للعقد القديمة بعد التحقق من المطابقة.',
        'طابور التعديلات بدون إنترنت الآمن من الفقدان: تسجيل كافة التعديلات وعمليات الحذف الفردية في mm_granular_v4_dirty_queue ودمجها حسب المعرف، وكتابة شواهد الحذف أولاً وتفريغها تلقائياً عند عودة الاتصال مع التأكيد.',
        'مؤشر مزامنة هادئ وأنيق بالقائمة الجانبية: مؤشر مدمج ومباشر داخل القائمة الجانبية يعرض الحالة لحظياً (جاري المزامنة، متزامن مع وقت المزامنة، أوفلاين، بانتظار اختيارك) مع إزالة كافة الإشعارات العائمة المزعجة.',
        'مزامنة فورية لملف العضو ومساحات المشاركة: تحديث غير إتلافي لبطاقة الملف الشخصي بروابط حية مباشرة، وانعكاس تلقائي فوري لأي معاملة مضافة أو معدلة في الشاشة الرئيسية داخل المساحات المشتركة.',
        'تثبيت WebAPK حقيقي ومستقل: توحيد مصدر ملف البيان manifest في VitePWA بأيقونات منفصلة (any و maskable) والتقاط مبكر للحدث للتثبيت كتطبيق شاشة رئيسية بدون شريط المتصفح.',
        'إشعارات متعددة الأسطر وبحث يشمل الملاحظات بالعربية: دعم التفاف الرسائل الطويلة وزمن عرض مرن حسب طول الرسالة، وتوحيد أحرف البحث والتشكيل العربي للبحث في التعليقات والملاحظات.',
      ],
    },
  },
  {
    version: '1.1.45',
    releaseDate: 'October 23, 2026',
    title: {
      en: 'Restored Deterministic Cloud Slots (0..9) + Master Share Engine, Strict Once-In-History Share Notifications & Pure Native PWA WebAPK Install',
      ar: 'استعادة محرك خانات المشاركة السحابية (0..9) + العقدة الرئيسية، إشعارات المشاركة لمرة واحدة مدى الحياة والتثبيت الأصلي الكامل لتطبيق PWA',
    },
    highlights: {
      en: [
        'Restored Deterministic Cloud Slots (0..9) + Master Share Engine: Eliminated root shared_accounts reads/listeners (which trigger PERMISSION_DENIED) and restored direct per-slot delivery (shared_accounts/slot_${target16Id}_0..9) paired with master space sync at shared_accounts/share_${space.id}.',
        'Strict Ownership Split & Dual Offline Persistence: Persists owned spaces in mm_my_owned_spaces and received spaces in mm_received_spaces for 100% offline reliability, strictly rendering spaces where cleanId(space.owner16DigitId) === myClean16Id in "Shared by Me" and !== myClean16Id in "Shared with Me".',
        'Strictly Once-In-History Share Notifications (Live & Offline-to-Online): Added permanent dual-registry tracking in localStorage (mm_notified_share_ids_forever) and Firebase RTDB (users/${uid}/notifiedShares/${cleanShareId} = true) with synchronous pre-tick locking, blocking owner self-notifications and re-notifications on edits or refreshes.',
        'Pure Native PWA WebAPK Installation & Zero Shortcut File Downloads: Completely removed all .html/.url Blob download code; clicking Install synchronously triggers promptEvent.prompt() while Workbox and the Service Worker pre-cache all app assets for 100% standalone offline execution.',
      ],
      ar: [
        'استعادة محرك الخانات السحابية القياسية (0..9) والعقدة الرئيسية للمشاركة: إلغاء قراءة الجذر العام لـ shared_accounts واستعادة التسليم المباشر عبر الخانات (shared_accounts/slot_${target16Id}_0..9) مع الربط اللحظي بالعقدة الرئيسية shared_accounts/share_${space.id}.',
        'فصل صارم للملكية وحفظ مزدوج بدون إنترنت: حفظ المساحات المملوكة في mm_my_owned_spaces والمساحات المستلمة في mm_received_spaces للعمل بدون إنترنت، مع عرض المساحات المطابقة لمعرّف المالك في "أنا مشيره" والمختلفة في "متشير معايا" بدقة تامة.',
        'إشعار واحد فقط مدى الحياة لكل مشاركة مستلمة (مباشر أو بعد فتح التطبيق): سجل دائم في التخزين المحلي (mm_notified_share_ids_forever) وسحابة Firebase (users/${uid}/notifiedShares/${cleanShareId} = true) مع قفل متزامن فوري يمنع تكرار الإشعار عند التحديث أو التعديل أو للمالك.',
        'تثبيت أصلي مباشر لتطبيق PWA وإلغاء تنزيل ملفات الاختصار نهائياً: حذف كافة أكواد تنزيل ملفات .html و.url؛ لتعمل نقرة التثبيت على إطلاق نافذة التثبيت الأصلية للنظام مباشرةً مع التخزين المسبق الكامل عبر Service Worker للعمل 100% بدون إنترنت.',
      ],
    },
  },
  {
    version: '1.1.44',
    releaseDate: 'October 23, 2026',
    title: {
      en: 'Complete V3 Shared Spaces Engine Rebuild, Once-Ever Offline/Online Share Notifications, Modal Form Input Fix & Direct Native PWA Install',
      ar: 'إعادة بناء شاملة لمحرك المساحات المشتركة V3، إشعارات المشاركة لمرة واحدة فقط (متصل/غير متصل)، إصلاح مدخلات النوافذ والتثبيت المباشر لـ PWA',
    },
    highlights: {
      en: [
        'Ground-Up V3 Rebuild of Shared Spaces Engine & Legacy Purge: Replaced legacy slot_*, inbox_*, and profile_directory_* nodes with a single canonical Firebase RTDB path shared_accounts/share_${space.id} and unified local cache (mm_spaces_v3_cache), guarded by a one-time clean migration (mm_share_v3_clean_reset).',
        'Fix Space Creation & Settings Input Reset Bug: Removed live-prop useEffect hooks that overwrote local form state (name, icon, members, accounts, categories) while ShareFolderModal or ShareSpaceSettingsModal was open; form state now initializes strictly once on modal open and commits only on Save/Create/Add.',
        'Strict Once-Ever Notification per Received Share (Live & Offline-to-Online): Eliminated the startup time-window block and implemented permanent dual-tracking in localStorage (mm_notified_shares_v3) and Firebase RTDB (users/${uid}/notifiedShares/${space.id} & member.notified = true), while strictly excluding space owners.',
        'Direct Synchronous Native PWA App Installation: Invokes window.deferredPwaPrompt.prompt() as the very first synchronous statement inside the Install click handler in Sidebar.tsx before any React state update, with clean Web-Shortcut fallback when beforeinstallprompt is unavailable.',
        'Offline-First Space Persistence & Timestamp-Guarded Sync: Writes created/edited spaces immediately to mm_spaces_v3_cache and queues offline cloud pushes; merges remote onValue updates only when remote.updatedAt > local.updatedAt (never while a modal is open) and permanently purges deleted spaces.',
      ],
      ar: [
        'إعادة بناء شاملة لمحرك المساحات المشتركة (V3) وتنظيف البيانات القديمة: استبدال كافة العقد القديمة بمسار سحابي موحد shared_accounts/share_${space.id} وذاكرة محلية موحدة (mm_spaces_v3_cache) مع ترحيل تلقائي لمرة واحدة (mm_share_v3_clean_reset).',
        'إصلاح مشكلة إعادة تعيين الاسم والأيقونة وإضافة الأعضاء أثناء التعديل: إزالة تأثيرات التحديث الخلفي التي كانت تمسح المدخلات أثناء فتح نافذة إنشاء أو إعدادات المساحة؛ لتتم تهيئة الحقول مرة واحدة فقط عند فتح النافذة وحفظها عند الضغط على زر الحفظ.',
        'إشعار واحد فقط مدى الحياة لكل مشاركة واردة (أثناء الاتصال أو بعد فتح التطبيق): إلغاء حظر الوقت المؤقت وتطبيق تتبع مزدوج دائم في التخزين المحلي (mm_notified_shares_v3) وسحابة Firebase (users/${uid}/notifiedShares و member.notified) مع استبعاد مالك المساحة نهائياً.',
        'التثبيت المباشر والفوري لتطبيق PWA على جميع الأجهزة: استدعاء prompt() كأول سطر برمجي متزامن فور نقر زر التثبيت في القائمة الجانبية قبل أي تحديث لحالة الواجهة، مع تنزيل اختصار مباشر في حال عدم توفر نافذة التثبيت التلقائية.',
        'حفظ فوري يعمل 100% بدون إنترنت ومزامنة ذكية للحذف: حفظ الإنشاء والتعديلات فوراً في mm_spaces_v3_cache وجدولة الرفع السحابي عند عودة الاتصال، ودمج التحديثات السحابية فقط عندما تكون أحدث زمنياً وعدم الكتابة أثناء فتح النوافذ، مع الحذف النهائي الفوري.',
      ],
    },
  },
  {
    version: '1.1.43',
    releaseDate: 'October 23, 2026',
    title: {
      en: 'Synchronous Native PWA Install, One-Time Share Notifications, Shared With Me Ownership Partition & Permanent Share Deletion Sync',
      ar: 'التثبيت المباشر الفوري لتطبيق PWA، إشعارات المشاركة لمرة واحدة، الفصل الدقيق لملكية المشاركات ومزامنة الحذف النهائي',
    },
    highlights: {
      en: [
        'Synchronous Native PWA Install on First User Gesture: Preserved user click gesture by immediately invoking promptEvent.prompt() synchronously before launching the 0% -> 100% offline Service Worker pre-caching progress modal, preventing Chrome/Android from blocking native home screen installation.',
        'Strict One-Time Notification per Share ID: Maintained persistent normalized share ID array (mm_notified_share_ids_perm) in localStorage; pre-seeds cached spaces on launch and suppresses repeated notifications so users only receive an alert the exact first time a new share arrives.',
        'Accurate "Shared by Me" vs. "Shared with Me" Partitioning: Fixed ownership attribution in syncFolderToCloud, fetchMyInboxOnce, and Hub views; tracked created spaces locally in mm_my_created_share_ids (space.isCreatedByMe = true), strictly preserved sender identity for received spaces (space.isReceivedShare = true), and migrated misplaced cached spaces.',
        'Comprehensive Real-Time Share Deletion & Tombstone Delivery: When space owner deletes a shared space, marks master cloud node with { deleted: true } and erases all member delivery slots (0..9), invite nodes, profile shares, and inboxes; recipients instantly detect deleted status and purge the space from local cache and UI in real time.',
        'Permanent Recipient Leave Blacklist: When a recipient leaves or deletes a received space, permanently records normalized shareId in mm_dismissed_share_ids (local and RTDB-backed), removes recipient from members list, and wipes their matching cloud slots so left shares never reappear.',
      ],
      ar: [
        'تثبيت فوري ومباشر لتطبيق PWA بإيماءة المستخدم الأولى: الحفاظ على أمان المتصفح عبر استدعاء promptEvent.prompt() لحظياً ومتزامناً مع نقرة الزر الأولى قبل بدء شريط تحميل التخزين بدون إنترنت، مما يمنع متصفح كروم/أندرويد من حجب نافذة التثبيت الأصلية.',
        'إشعار واحد فقط وثابت لكل مساحة مشاركة جديدة: إنشاء سجل دائم للمعرفات التي تم الإشعار عنها (mm_notified_share_ids_perm) في التخزين المحلي؛ استبعاد المساحات المخزنة مسبقاً والتأكد من إشعار المستخدم مرة واحدة فقط عند وصول مشاركة جديدة لأول مرة.',
        'فصل دقيق للملكية بين "مشاركاتي" و"مشارك معي": حماية بيانات المرسل في مزامنة السحابة واستقبال المشاركات، وتسجيل المساحات المنشأة محلياً في mm_my_created_share_ids مع وضع علامة isReceivedShare للمستلم، وترحيل وتصحيح أي مساحات مشاركة وُضعت سابقاً في التبويب الخاطئ.',
        'حذف نهائي فوري وشامل ومسح خانات التسليم: عند قيام المالك بحذف مساحة مشاركة، يتم تعليم العقدة السحابية بعلامة { deleted: true } ومسح جميع خانات التسليم (0..9) والدعوات وصناديق الوارد للأعضاء؛ ليكتشف المستلمون الحذف لحظياً ويتم إزالة المساحة من أجهزتهم وشاشاتهم فوراً.',
        'قائمة سوداء دائمة للمشاركات المغادرة (Blacklist): عند مغادرة أو حذف المستلم لمساحة مشاركة، يُسجل معرف المشاركة في mm_dismissed_share_ids محلياً وسحابياً مع مسح خانات المستخدم وإزالته من قائمة الأعضاء لمنع عودة المساحة للظهور مجدداً.',
      ],
    },
  },
  {
    version: '1.1.42',
    releaseDate: 'October 23, 2026',
    title: {
      en: 'Fix ID Cursor Editing, Viewer Permissions, Toast Storm, Transfer Share Cards & Bandwidth Optimization',
      ar: 'إصلاح مؤشر كتابة المعرف 16 رقماً، صلاحيات المشاهد، عاصفة الإشعارات، بطاقات التحويل ومطابقة استهلاك الإنترنت',
    },
    highlights: {
      en: [
        'Smooth 16-Digit ID Editing Without End-Jumping Cursor: Fixed 16-digit ID input cursor position preservation in Share modals and user picker; formats 4-digit groups (XXXX XXXX XXXX XXXX) on input while keeping the cursor exactly at the edited digit offset via requestAnimationFrame.',
        'Landscape Split Layout Sticky Left Panel: Anchored summary card and added quick accounts balance breakdown card on the left panel (sticky top-4 max-h-[calc(100dvh-6rem)]) so landscape view remains balanced during timeline scrolling.',
        'Interactive PWA Pre-Cache Progress & Auto-Install: Added full visual download & cache overlay (0% -> 100%) actively pre-caching bundles and assets via Cache Storage API, then immediately triggering native OS desktop/home-screen installation.',
        'Complete Transfer Transactions in Shared Spaces: Preserved full transfer metadata (dual account names, icons, before/after balances) with dedicated transfer pill visualization across ShareDetailView and StandaloneShareView.',
        'Strict Viewer vs. Editor Role Enforcement: Guarded Add Transaction, edit handlers, and delete actions behind canCurrentUserEdit; restricted personal feed deletion checkbox strictly to space owners or items confirmed in personal local storage.',
        'Multi-Select & Confirmation Sheet Import to Personal Account: Enabled long-pressing individual transactions, days, and months in ShareDetailView to multi-select items and import selected or all transactions directly into a chosen personal account with automatic category matching and duplicate prevention.',
        'Elimination of Toast Notification Storms: Added persistent seen share notification map (mm_seen_share_notifications) and 2.5s initial hydration guard; only fires a single toast when a genuinely new unseen share arrives, and deduplicates active toasts with a 3-second cooldown.',
        'Live Profile Propagation & Zero Idle Bandwidth: Propagated updated Name, Avatar emoji, and PhotoURL across all owned and member shared spaces in real time; optimized network usage by relying on event-driven onValue listeners (zero bandwidth when idle), throttled fallback polling to 15s in foreground hub only, and skipped duplicate cloud writes.',
      ],
      ar: [
        'تحرير معرف الـ 16 رقماً بسلاسة دون قفز المؤشر: إصلاح تحرك مؤشر الكتابة في حقول المعرف المكون من 16 رقماً في نوافذ المشاركة والبحث؛ الحفاظ على تنسيق المجموعات الرباعية وموضع المؤشر الدقيق عند التعديل في المنتصف.',
        'لوحة جانبية مثبتة في الوضع الأفقي (Landscape): تثبيت ملخص الحسابات وبطاقة التوزيع السريع للأرصدة في العمود الأيسر في الوضع الأفقي للحفاظ على التوازن البصري أثناء التمرير في سجل المعاملات.',
        'شريط تقدم التحميل المسبق وتثبيت التطبيق المباشر (PWA): شاشة تفاعلية لتحميل وتخزين كافة ملفات التطبيق (0% إلى 100%) بدون إنترنت عبر Cache Storage API وتثبيت التطبيق مباشرة للشاشة الرئيسية.',
        'عرض معاملات التحويل بين الحسابات بكامل بياناتها في المشاركات: الحفاظ على بيانات التحويل (اسم وأيقونة الحسابين، الأرصدة قبل وبعد) مع عرض شريط تفاعلي في ShareDetailView و StandaloneShareView.',
        'تطبيق صارم لصلاحيات المشاهد (Viewer) والمحرر (Editor): إخفاء وتعطيل أزرار الإضافة والتعديل والحذف لمستخدمي المشاهدة فقط؛ وقصر خيار الحذف من الحساب الشخصي على مالك المساحة أو المعاملات الموجودة بالفعل محلياً.',
        'التحديد المتعدد واستيراد المعاملات للحساب الشخصي في صفحة المشاركة: إمكانية الضغط المطول لتحديد المعاملات والأيام والأشهر، مع نافذة تأكيد لاختيار الحساب الشخصي المستهدف والمطابقة الذكية للتصنيفات وتخطي التكرار.',
        'القضاء النهائي على عاصفة الإشعارات المتكررة: إضافة سجل مستمر للإشعارات المعروضة (mm_seen_share_notifications) وحاجز زمني للتحميل الأولي، ومنع تكرار الإشعارات مع حد أقصى للظهور وتجميع الرسائل المتطابقة.',
        'مزامنة الاسم والصورة لحظياً وترشيد استهلاك الإنترنت: تعميم تحديثات الاسم وصورة الملف الشخصي عبر كافة المساحات المشتركة (كمالك أو عضو) لحظياً، والاعتماد الكامل على مستمعي onValue التي لا تستهلك أي بيانات أثناء الخمول مع تقليص الاستعلام الاحتياطي إلى كل 15 ثانية داخل النافذة فقط.',
      ],
    },
  },
  {
    version: '1.1.41',
    releaseDate: 'October 23, 2026',
    title: {
      en: 'Fix Sender-Receiver Cloud Share Slot Sync, Tablet Scrolling, Calculator/FAB Nav Clearance & Direct 1-Click PWA Install',
      ar: 'إصلاح مزامنة خانات المشاركة السحابية، التمرير على التابلت، خلوص الحاسبة والزر العائم من شريط التنقل وتثبيت PWA المباشر',
    },
    highlights: {
      en: [
        'Isolated Cloud Space Delivery & Deterministic Slot Publishing: Completely isolated individual Firebase writes with deep JSON sanitization, guaranteeing space delivery to recipient "Shared with Me" tabs across slots 0..9 without permission cascades.',
        'Receiver Promise.allSettled Pipeline: Refactored fetchMyInboxOnce to read all cloud slots, directory maps, and inboxes with Promise.allSettled, merging live master nodes and updating React state instantly without page refresh.',
        'Smooth Tablet & Large-Screen Vertical Scrolling: Removed non-scrollable flex wrapper overflow-hidden and enforced overflow-y-auto touch-pan-y overscroll-y-contain min-h-0 flex-1 across all screen sizes.',
        'Calculator Keypad & Navigation Clearance: Recalculated container height and bottom clearance (h-[calc(100dvh-9.5rem)] md:h-[calc(100dvh-11.5rem)] pb-20 md:pb-28), keeping all keypad rows 100% visible and tappable.',
        'Direct Responsive Floating Action Button (+): Anchored the floating "+" button cleanly to the bottom corner (bottom-24 md:bottom-28 right-4 md:right-8) strictly elevated above the navigation bar.',
        'Instant 1-Click PWA Installation: Captured beforeinstallprompt in early inline head script into window.deferredPwaPrompt and component state; triggers native installation immediately on click without instructional modals.',
      ],
      ar: [
        'تسليم مساحات السحابة المستقل ونشر الخانات الحتمية: عزل عمليات الكتابة في Firebase مع تعقيم JSON العميق، مما يضمن تسليم المساحة المشتركة لقسم "تمت مشاركتها معي" عبر الخانات 0..9 دون توقف.',
        'مسار الاستلام عبر Promise.allSettled: إعادة بناء fetchMyInboxOnce لقراءة كافة الخانات والدليل والصناديق بالتوازي دون انقطاع، مع تحديث واجهة المستخدم لحظياً دون الحاجة لإعادة تحميل الصفحة.',
        'تمرير رأسي سلس على التابلت والشاشات الكبيرة: إزالة overflow-hidden المقيد وتطبيق حاوية تمرير مرنة تدعم touch-pan-y و overscroll-y-contain لضمان التمرير باللمس وعجلة الماوس.',
        'خلوص أزرار الحاسبة من شريط التنقل: تعديل حسابات ارتفاع الحاسبة لتوفير مساحة أمان علوية وسفلية تضمن ظهور كافة أزرار لوحة المفاتيح وسهولة لمسها دون تداخل.',
        'تثبيت الزر العائم (+) في زاوية الشاشة المتجاوبة: تثبيت زر الإضافة في الزاوية السفلية بارتفاع كافٍ فوق شريط التنقل ليظل بارزاً وسهل الوصول على الهواتف والأجهزة اللوحية.',
        'تثبيت تطبيق الويب التقدمي (PWA) بنقرة واحدة: التقاط حدث beforeinstallprompt مبكراً في ترويسة HTML وحالة React؛ تشغيل نافذة التثبيت الأصلية فوراً عند النقر بدون نوافذ إرشادية.',
      ],
    },
  },
  {
    version: '1.1.40',
    releaseDate: 'October 23, 2026',
    title: {
      en: 'Deep Fix for Shared With Me Delivery, Owner Avatar Sync, Long-Press Section Select & Tablet Responsive UI',
      ar: 'إصلاح شامل لتسليم المشاركات المشتركة معي، مزامنة صورة المالك، التحديد بالضغط المطول وتجاوب أجهزة التابلت',
    },
    highlights: {
      en: [
        'Deep Shared With Me Space Delivery: Guaranteed cross-device delivery of shared spaces to recipient "Shared with Me" tabs via direct profile lookup slots (profile_shares, profile_directory, and slot mapping) with real-time onValue listeners and sanitization of undefined fields.',
        'Owner Profile Photo Sync: Share space owners now clearly display their actual Google profile avatar / custom photo alongside their name across space headers, member lists, and "Shared with Me" cards.',
        'Long-Press Section Multi-Select: Hidden checkboxes on Day and Month headers by default during normal browsing; regular tap toggles accordion expand/collapse, while long-press enters Multi-Select mode and selects the entire section.',
        'Tablet Landscape Orientation Support: Removed orientation restrictions across WebAPK manifests, HTML link tags, and window screen orientation API, enabling unrestricted landscape rotation on tablets and phones.',
        'Responsive Tablet Bottom Navigation & Calculator View: Replaced cramped mobile sizing with proportional tablet layouts—Navigation bar scales to h-20 with larger icons and typography, and Calculator expands to full responsive width with large touch-friendly buttons.',
      ],
      ar: [
        'إصلاح شامل لتسليم المشاركات المشتركة معي: ضمان تسليم المساحات المشتركة عبر الأجهزة لقسم "تمت مشاركتها معي" للمستلم عبر خانات الملف الشخصي الحتمية ومستمعات onValue الفورية وتعقيم الحقول غير المعرفة.',
        'مزامنة صورة الملف الشخصي للمالك: يظهر مالك المساحة المشتركة الآن بصورته الشخصية الحقيقية بجانب اسمه في ترويسة الصفحة وقوائم الأعضاء وبطاقات المشاركة.',
        'التحديد المتعدد للأقسام بالضغط المطول: إخفاء مربعات الاختيار في ترويسات الأيام والشهور افتراضياً، حيث تقوم النقرة العادية بالفتح والطي، بينما يقوم الضغط المطول بتفعيل وضع التحديد وتحديد كافة معاملات القسم.',
        'دعم الوضع الأفقي لأجهزة التابلت: إزالة قيود الاتجاه الرأسي عبر ملفات manifest ووسوم HTML وواجهة برمجة تطبيقات اتجاه الشاشة لتوفير دوران أفقي سلس.',
        'تجاوب شريط التنقل السفلي والحاسبة للأجهزة اللوحية: ترقية المقاسات الضيقة بتنسيق متجاوب للأجهزة اللوحية—شريط تنقل بارتفاع h-20 بأيقونات ونصوص أكبر، وتوسيع الحاسبة لتشغل العرض الكامل بأزرار عريضة وسهلة اللمس.',
      ],
    },
  },
  {
    version: '1.1.39',
    releaseDate: 'October 23, 2026',
    title: {
      en: 'Dual Transfer Balances, Section Multi-Select, Cloud Merge Race Condition Fix & Live Share Delivery',
      ar: 'أرصدة التحويل المزدوجة، التحديد المتعدد للأقسام، معالجة تزامن دمج السحابة والتسليم المباشر للمشاركات',
    },
    highlights: {
      en: [
        'Dual Account Balances on Transfers: Both source and destination accounts now record and display their exact balances before and after each transfer (fromBalanceBefore -> fromBalanceAfter & toBalanceBefore -> toBalanceAfter) on transaction cards and detail modals.',
        'Day & Month Section-Level Multi-Select: Added bulk toggle checkboxes to Month and Day headers across Home, Account Details, and Shared Spaces to select or deselect all transactions in an entire section with one tap.',
        'Cloud Sync Pre-Hydration & Empty Device Auto-Restore: Cloud backup data is strictly isolated in pending state before the user chooses Merge or Replace, and completely empty devices automatically restore cloud data instantly.',
        'Deterministic Share Space Delivery: Guaranteed delivery to recipient "Shared with Me" tabs via direct profile lookups (shared_accounts/profile_shares_${targetClean16Id}_${shareId}), slot mapping, and real-time polling loops.',
        'Direct 16-Digit ID Tap-to-Copy: Cleaned up the Sidebar profile card by removing cramped copy icons in favor of direct badge tapping with animated toast confirmation.',
        'Persistent Google Drive Cloud Status: Persisted Drive permission resolution status inside the cloud profile so new device logins never re-prompt unnecessarily.',
        'Decoupled Input State: Completely eliminated input cursor jumping and value resetting when editing usernames, budgets, accounts, or categories.',
        'Read-Only Verified Member Profiles: Locked fetched username and avatar as read-only cards when inviting members by 16-digit ID to prevent alteration of user identities.',
        'Installed PWA Landscape Rotation: Unlocked orientation in manifest, HTML link tags, and window screen orientation API for seamless horizontal tablet and phone usage.',
      ],
      ar: [
        'أرصدة مزدوجة للتحويلات المالية: تسجيل وعرض أرصدة الحسابين (المصدر والوجهة) قبل وبعد كل عملية تحويل بدقة (قبل/بعد لكل حساب) على بطاقات المعاملات وشاشة التفاصيل.',
        'تحديد متعدد لكامل الأيام والشهور: إضافة مربعات اختيار شاملة في ترويسات الأيام والشهور في الواجهة الرئيسية وتفاصيل الحساب والمساحات المشتركة لتحديد أو إلغاء تحديد كافة المعاملات بنقرة واحدة.',
        'منع التحميل المسبق للسحابة والاستعادة التلقائية: عزل بيانات النسخ الاحتياطي السحابي تماماً قبل اختيار المستخدم للدمج أو الاستبدال، مع الاستعادة التلقائية الفورية للأجهزة الفارغة الجديدة.',
        'تسليم مؤكد لمساحات الشير للمستلمين: ضمان ظهور المساحات المشتركة في قسم "تمت مشاركتها معي" عبر فهرسة الملفات المباشرة والخانات السحابية الحتمية مع حلقة مزامنة دورية.',
        'نسخ المعرف المكون من 16 رقماً بلمسة مباشرة: تنظيف بطاقة المستخدم في الشريط الجانبي وإزالة أيقونات النسخ المزدحمة مع تفعيل النسخ المباشر بلمس المعرف وإظهار إشعار تأكيد.',
        'حفظ حالة تخزين جوجل درايف سحابياً: مزامنة إذن الوصول لجوجل درايف داخل الملف الشخصي السحابي لعدم تكرار الطلب عند تسجيل الدخول من جهاز جديد.',
        'عزل حالات الإدخال لمنع التراجع: القضاء التام على خلل ارتداد القيم ومسح النصوص أثناء الكتابة في الملف الشخصي والميزانية والحسابات والفئات.',
        'بطاقات تحقق للقراءة فقط للأعضاء: قفل اسم وصورة المستخدم المستلم كبطاقة موثقة للقراءة فقط عند الدعوة بالمعرف المكون من 16 رقماً لحماية هوية المستخدمين.',
        'دعم كامل للتدوير الأفقي لتطبيقات PWA: فك قفل التدوير في المانيفست وملفات التشغيل لدعم الاستخدام الأفقي السلس على الهواتف والأجهزة اللوحية.',
      ],
    },
  },
  {
    version: '1.1.38',
    releaseDate: 'October 23, 2026',
    title: {
      en: 'Transaction Account Selector Fix, Transfer Auto-Swap, Dual Balance Tracking, and Section Multi-Select',
      ar: 'إصلاح محدد الحساب بالمعاملات، التبديل التلقائي للتحويلات، تتبع الرصيد المزدوج، وتحديد الأيام والشهور المتعدد',
    },
    highlights: {
      en: [
        'Instant Account Selection in Transaction Modals: Resolved the critical bug where selecting accounts stayed locked on the primary account. Form initialization is now strictly isolated to modal launch and transaction ID changes, decoupled from live context updates.',
        'Intelligent Transfer Auto-Swap: In Transfer mode, selecting a From Account matching the To Account (or vice versa) automatically swaps the accounts instantaneously without disabling options or blocking selections.',
        'Dropdown Focus & Tap Reliability: Added onMouseDown preventDefault and pointerdown propagation guards on account picker dropdowns, ensuring every tap registers cleanly without premature blur dismissal.',
        'Dual Before & After Balances on Transfers: Transfers now record and display both source and destination accounts before and after balances (fromBalanceBefore -> fromBalanceAfter & toBalanceBefore -> toBalanceAfter) on transaction cards and detail views.',
        'Day & Month Section Multi-Select: Added bulk toggle checkboxes to Month and Day headers on Home, Account Details, and Shared Views for selecting or deselecting all transactions in an entire day or month at once.',
        'Streamlined 16-Digit ID Tap-to-Copy: Removed cramped copy icon in the Sidebar; tapping directly on the 16-digit ID badge copies it immediately with a bilingual toast notification.',
      ],
      ar: [
        'اختيار فوري للحسابات في نوافذ المعاملات: معالجة المشكلة التي كانت تعيد تثبيت الحساب على الحساب الافتراضي عند الاختيار، عبر عزل تهيئة النموذج لتقتصر فقط على لحظة فتح النافذة أو تغيير المعاملة.',
        'التبديل التلقائي الذكي في التحويلات: عند اختيار نفس الحساب في حقلي (من / إلى) في المعاملات المالية، يقوم النظام بتبديل الحسابين تلقائياً وبشكل فوري دون تعطيل الخيارات أو حظر المستخدم.',
        'موثوقية فائقة لقوائم الحسابات المنسدلة: منع الإغلاق التلقائي المبكر عند النقر عبر حماية أحداث pointerdown وتثبيت التحديد فوراً عند الضغط على أي حساب.',
        'عرض الأرصدة قبل وبعد لكلا الحسابين في التحويل: تسجيل وعرض أرصدة الحساب المحول منه والمحول إليه قبل وبعد التحويل بوضوح على بطاقة المعاملة وفي شاشة التفاصيل.',
        'التحديد المتعدد لكامل الأيام والشهور: إضافة مربعات تحديد مباشر على ترويسة كل شهر وكل يوم بالصفحة الرئيسية وتفاصيل الحساب والمساحات المشتركة لتحديد أو إلغاء تحديد كافة معاملات اليوم أو الشهر بضغطة واحدة.',
        'نسخ المعرف المكون من 16 رقماً بلمسة واحدة: إزالة أيقونة النسخ المزدحمة في الشريط الجانبي وإتاحة نسخ المعرف فوراً بالنقر المباشر عليه مع إشعار تأكيد ثنائي اللغة.',
      ],
    },
  },
  {
    version: '1.1.37',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Custom Import, In-App Update System, Complete Sign-Out Reset, Deterministic Cloud Slots, and Mobile Landscape Support',
      ar: 'استيراد مخصص، نظام التحديث المباشر بالتطبيق، تصفير تسجيل الخروج الكامل، خانات المشاركة السحابية، ودعم التدوير الأفقي للهواتف والأجهزة اللوحية',
    },
    highlights: {
      en: [
        'Full Custom Import Alongside Custom Export: Added an interactive Custom Import modal that lets users select a backup file, previews item counts across Accounts, Categories, Transactions, Budgets, and Shared Spaces, allows selective section importing, and offers Merge (deduplicating by ID) or Replace modes with immediate cloud backup.',
        'Professional In-App Update System: Completely removed raw GitHub repository URLs and commit metadata from update modals. Added an in-app Auto-Update toggle and a manual "Check & Update Now" button in the Sidebar that cleans Service Worker caches with an active progress indicator and reloads into new builds seamlessly.',
        'Instant Profile & Auth State Cleanup on Sign-Out: Fixed sign-out state persistence by instantly removing cached authenticated user tokens, bound account UIDs, and Google Drive keys from localStorage, unsubscribing cloud listeners, and immediately resetting profile state to clean Guest defaults ({ name: "Guest", email: "", photoURL: "", avatar: "", uid: null }).',
        'Deterministic Cloud Invite Slots (slot_${targetClean16Id}_0..9): Solved Firebase RTDB multi-device delivery under strict security rules by writing share spaces into 10 deterministic sender-owned cloud slots alongside master nodes (shared_accounts/share_${shareId}), with real-time onValue listeners and 4-second polling loops ensuring recipients see shared spaces immediately even when offline.',
        'Mobile Phone & Tablet Landscape Rotation Support: Removed portrait orientation restrictions in VitePWA manifest and public/manifest.json ("orientation": "any"), removed portrait CSS constraints, and upgraded all 5 main views (Home, Budget, Insights, Accounts, Calculator) with responsive 2-column layouts and compact vertical spacing in landscape mode.',
      ],
      ar: [
        'استيراد مخصص كامل بجانب التصدير المخصص: إضافة نافذة استيراد مخصص تتيح اختيار ملف النسخة الاحتياطية، ومعاينة أعداد الحسابات والفئات والمعاملات والميزانيات ومساحات المشاركة، مع إمكانية تحديد أقسام مخصصة للاستيراد والاختيار بين الدمج (منع التكرار بالمعرف) أو الاستبدال مع تحديث فوري للمزامنة السحابية.',
        'نظام تحديثات التطبيق المباشر داخل التطبيق: إزالة جميع روابط ومعلومات GitHub الخام من نوافذ التحديث، وإضافة زر تبديل للتحديث التلقائي وزر فحص وتحديث فوري بالشريط الجانبي يقوم بتنظيف كاش Service Worker مع مؤشر تقدم وإعادة تحميل سلسة للإصدار الجديد.',
        'تصفير فوري لبيانات المستخدم وتسجيل الخروج: معالجة بقاء الاسم والصورة بعد تسجيل الخروج عبر الحذف الفوري لبيانات المستخدم المحفوظة وربط الحساب ومفاتيح جوجل درايف، وإلغاء اشتراك مستمعي السحابة، وإعادة الملف الشخصي فوراً لوضع الضيف النظيف ({ name: "Guest", email: "", photoURL: "", avatar: "", uid: null }).',
        'خانات المشاركة السحابية الحتمية (slot_${targetClean16Id}_0..9): حل تسليم مساحات الشير عبر الأجهزة حتى في ظل قواعد أمان فايربيس الصارمة عبر الكتابة في 10 خانات سحابية يملكها المرسل بجانب العقدة الرئيسية (shared_accounts/share_${shareId})، مع مستمعين فوريين وحلقة تحديث كل 4 ثوانٍ لظهور الشير فوراً في "تمت مشاركتها معي".',
        'دعم كامل للتدوير الأفقي (Landscape) للهواتف والأجهزة اللوحية: إلغاء حصر الاتجاه الرأسي في ملفات المانيفست ("orientation": "any")، وإزالة قيود CSS الرأسية، وتحديث الواجهات الرئيسية الخمس (الرئيسية، الميزانية، التحليلات، الحسابات، الحاسبة) بشبكات مرنة من عمودين ومسافات عمودية مدمجة عند التدوير أفقياً.',
      ],
    },
  },
  {
    version: '1.1.36',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Device Account Binding, Two-Way Silent Cloud Sync, and Member UI Polish',
      ar: 'ربط الحساب بالجهاز، المزامنة السحابية الصامتة بالاتجاهين، وتحسين واجهة الأعضاء',
    },
    highlights: {
      en: [
        'Persistent Device Account Binding: Eliminated repeated "Merge vs. Replace" modals on page reload or app update by binding signed-in devices via mm_bound_account_uid, strictly limiting the modal to true initial transitions from guest mode with local data.',
        'True Two-Way Silent Real-Time Cloud Sync: Every data modification pushes the latest snapshot with timestamps and security rule fields to users/${uid}/cloud_backup and shared_accounts/backup_${uid} (and Google Drive if authorized), while reloads and remote changes silently pull newer data without interrupting the user.',
        'Instant Real-Time 16-Digit Share Delivery: Resolved Firebase rule write collisions by dispatching dedicated sender-owned invite nodes (shared_accounts/invite_${targetClean16Id}_${shareId}) paired with root onValue listeners and 3-second polling to immediately hydrate "Shared with Me".',
        'Streamlined Hub & Redesigned Member Cards: Completely removed manual paste link fields in favor of automated 16-digit sharing, and overhauled the Share Members card in Detail View into an unclipped two-row layout with 40x40px avatar circles and clear role badges.',
      ],
      ar: [
        'ربط الحساب الدائم بالجهاز: منع ظهور نافذة "الدمج مقابل الاستبدال" نهائياً عند تحديث الصفحة أو إعادة تشغيل التطبيق عبر تخزين معرف الربط mm_bound_account_uid، وحصر النافذة في حالة الانتقال الأولي من وضع الضيف الذي يحتوي على معاملات محلية.',
        'مزامنة سحابية صامتة ولحظية بالاتجاهين: كل تعديل على البيانات يقوم برفع لقطة البيانات فوراً مع الطابع الزمني وحقول الأمان إلى users/${uid}/cloud_backup وshared_accounts/backup_${uid} وجوجل درايف، مع سحب التغييرات الأحدث سحابياً تلقائياً ودون إزعاج المستخدم بنوافذ.',
        'تسليم فوري للمشاركات بالمعرف الرقمي (16 رقماً): حل تعارض قواعد أمان فايربيس عبر إنشاء عقد دعوة مخصصة يملكها المرسل (shared_accounts/invite_${targetClean16Id}_${shareId}) مع ربط مستمع فوري لـ shared_accounts وتحديث كل 3 ثوانٍ للظهور الفوري في "تمت مشاركتها معي".',
        'تبسيط مركز المشاركات وتحسين بطاقة الأعضاء: إزالة خانة لصق الروابط يدوياً للاعتماد الكامل على المعرف الرقمي الفوري، وإعادة تصميم بطاقة أعضاء الشير في صفحة التفاصيل لتكون من صفين دون أي اقتطاع للصور الدائرية بمقاس 40x40 مع شارات الأدوار الواضحة.',
      ],
    },
  },
  {
    version: '1.1.35',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Real-Time 16-Digit Share Delivery, Streamlined Hub, and Member Avatar Layout Fixes',
      ar: 'تسليم المشاركات الفوري بالمعرف الرقمي، تبسيط نافذة المشاركة، وتحسين مظهر الأعضاء',
    },
    highlights: {
      en: [
        'Instant Real-Time 16-Digit Share Delivery: Resolved Firebase RTDB ownerUid collision by delivering share spaces through dedicated sender-owned invite nodes (shared_accounts/invite_${targetClean16Id}_${shareId}) and an active shared_accounts root listener with 3-second polling, ensuring instant delivery into "Shared with Me".',
        'Streamlined In-App Sharing: Removed manual "Paste Share Link / Join via Link" input boxes from the Shared Accounts Hub, establishing automated 16-digit real-time sharing for in-app collaboration while reserving Copy Link strictly for external browsers.',
        'Redesigned Share Members Card in Detail View: Fixed crushed layout and clipped avatar icons by introducing a clean two-row layout. Row 1 features the unclipped member counter alongside Manage and Add Member buttons (removing the duplicate Settings button), while Row 2 provides a full-width horizontal scroll with 40x40px unclipped avatars, names, and role badges.',
      ],
      ar: [
        'تسليم فوري للمشاركات عبر المعرف المكون من 16 رقماً: تجاوز تعارض قواعد فايربيس (ownerUid) عبر كتابة دعوات مخصصة يملكها المرسل (shared_accounts/invite_${targetClean16Id}_${shareId}) وربط مستمع فوري لـ shared_accounts مع دورة تحديث كل 3 ثوانٍ للظهور الفوري في "تمت مشاركتها معي".',
        'تبسيط واجهة المشاركة الداخلية: إزالة خانة وأزرار "لصق الرابط / الانضمام عبر الرابط" يدوياً داخل التطبيق، والاعتماد بالكامل على المعرف الرقمي الفوري لمشاركة الحسابات داخلياً، مع حصر زر نسخ الرابط للاستعراض الخارجي.',
        'إعادة تصميم بطاقة أعضاء المشاركة في صفحة التفاصيل: حل مشكلة انضغاط العناصر واقتطاع صور الأعضاء عبر اعتماد تصميم من صفين: الصف الأول يعرض العنوان وأزرار إدارة وإضافة الأعضاء (مع إزالة زر الإعدادات المكرر)، والصف الثاني يعرض شريطاً أفقياً كاملاً لبطاقات الأعضاء بصور دائرية غير مقتطعة بمقاس 40x40 مع الأسماء وشارات الأدوار.',
      ],
    },
  },
  {
    version: '1.1.34',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Smart Cloud Sync & Account Data Conflict Resolution',
      ar: 'المزامنة السحابية الذكية وحل تعارض بيانات الحساب',
    },
    highlights: {
      en: [
        'Share Hub Authentication Decoupling: Removed any requirement for a Google Drive token in Shared Spaces; authenticated sessions and cached offline users now access the Shared Spaces Hub immediately without encountering sign-in loops.',
        'Decoupled Google Drive Permission & Graceful Fallback: Google Drive storage scope is requested during sign-in, with a one-time optional prompt explicitly labeled "Grant Storage Access". Granting, denying, closing, or quota exhaustion permanently suppresses the prompt and seamlessly falls back to our Firebase RTDB server at users/${uid}/cloud_backup.',
        'Elimination of Overwrite Race Condition: Automatic cloud backup writes are strictly locked on sign-in (isCloudHydratedRef.current = false) until existing cloud backups are thoroughly inspected, preventing local device state from ever overwriting remote data.',
        'Account Data Sync Conflict Modal (z-[95]): When cloud data exists alongside local device transactions, users are prompted to either "Replace Device Data with Account Data" or "Merge Current Device Data with Account Data" (deduplicated by ID). If 0 local transactions exist, account data auto-restores immediately.',
        'Full Profile & 16-Digit ID Hydration: Whether replacing or merging on sign-in, the user’s display name, avatar, custom avatar URL, and permanent 16-digit ID are restored to local state and instantly published to shared_accounts/profile_${clean16Id} in Firebase RTDB.',
      ],
      ar: [
        'فك ارتباط مساحات المشاركة بصلاحيات جوجل درايف: إلغاء اشتراط رمز Google Drive لفتح مساحات المشاركة، وإتاحة الدخول الفوري للجلسات المسجلة والجلسات المحفوظة دون اتصال دون الوقوع في حلقة تسجيل الدخول.',
        'فصل صلاحية تخزين Google Drive والتحويل التلقائي للخادم: طلب صلاحية Drive عند تسجيل الدخول مع نافذة اختيارية لمرة واحدة بزر يحمل نص "منح صلاحية التخزين"، مع حفظ الاختيار نهائياً والتحويل السلس والتلقائي للنسخ عبر خادم فايربيس في users/${uid}/cloud_backup.',
        'منع الكتابة العرضية فوق البيانات السحابية: قفل عمليات النسخ الاحتياطي التلقائي تماماً عند تسجيل الدخول حتى اكتمال فحص النسخ السحابية لمنع استبدال بيانات الحساب ببيانات الجهاز المحلية.',
        'نافذة حل تعارض بيانات الحساب (z-[95]): عند وجود بيانات سحابية ومعاملات محلية، يتاح للمستخدم خيار "استبدال بيانات الجهاز ببيانات الحساب" أو "دمج البيانات الحالية مع بيانات الحساب" دون تكرار المعرفات، مع الاستعادة التلقائية الفورية عند عدم وجود معاملات محلية.',
        'استعادة ومزامنة كامل الملف الشخصي والمعرف الثابت: استعادة اسم المستخدم وصورته ومعرفه الرقمي المكون من 16 رقماً فور الاستبدال أو الدمج وحفظها في الحالة المحلية ونشرها تلقائياً على shared_accounts/profile_${clean16Id} في فايربيس.',
      ],
    },
  },
  {
    version: '1.1.33',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Consolidated Sync & Resilience Release: Google-Only Auth, Dual-Layer Cloud Backup & Offline Persistence',
      ar: 'إصدار المزامنة والاستقرار الشامل: حصر المصادقة بجوجل، النسخ السحابي المزدوج، والاستمرار دون إنترنت',
    },
    highlights: {
      en: [
        'Shared Space Ownership Separation: Fixed recipient space categorization so spaces shared with the user strictly appear in "Shared with Me" and spaces created by the user appear in "Shared by Me", with automatic local migration.',
        'Google-Only Authentication: Disabled email, password, and phone/SMS authentication forms to establish Google Sign-In as the unified, secure, 1-click authentication provider across the entire app.',
        'Automatic Google Drive Backup & Auto-Restore: Configured OAuth Drive scopes, captured access tokens, and engineered an automatic dual-layer cloud backup engine that saves the entire app state to Google Drive on data changes/login and auto-restores on sign-in.',
        'Seamless Firebase Server Fallback: If Google Drive upload or fetch fails for any reason (missing/expired token or network issue), seamlessly falls back to saving and restoring from Firebase RTDB at users/${uid}/cloud_backup.',
        'Streamlined Sidebar Menu: Completely removed manual backup and restore buttons and progress bars from the Sidebar and UserProfileModal since cloud backup and restoration are now 100% automated upon sign-in and data changes.',
        'Offline Persistence & No Offline Sign-Out: Enabled browserLocalPersistence and mirrored authenticated sessions to localStorage (mm_cached_authenticated_user) so the app launches and operates 100% offline without ever signing out users unless they explicitly click Sign Out.',
        'Offline Queuing & Workbox Service Worker: Automatically queues cloud backups and share updates when offline, flushing them on reconnect, and configured Workbox navigateFallback: "index.html" to ensure reliable zero-connection launches.',
      ],
      ar: [
        'فصل ملكية مساحات المشاركة: إصلاح تصنيف المساحات لضمان ظهور المساحات المتشاركة مع المستخدم في "متشير معايا" وحصر مساحاته في "أنا مشيره" مع تصحيح ونقل تلقائي للمساحات المحلية.',
        'حصر المصادقة بتسجيل الدخول عبر جوجل: إزالة نماذج تسجيل الدخول بالبريد ورقم الهاتف وكلمات المرور بالكامل واعتماد تسجيل الدخول بحساب جوجل كوسيلة المصادقة الموحدة والآمنة بنقرة واحدة.',
        'نسخ احتياطي واستعادة تلقائية لجوجل درايف: تضمين صلاحيات Drive وحفظ رمز الوصول وبناء محرك نسخ سحابي تلقائي يحفظ كامل بيانات الحسابات والمعاملات والمساحات على Google Drive عند كل تغيير واستعادتها تلقائياً عند تسجيل الدخول.',
        'خادم سحابي احتياطي بديل على فايربيس: عند تعذر الاتصال بجوجل درايف أو انتهاء صلاحية الرمز، يتم الحفظ والاستعادة بسلاسة ودون انقطاع عبر خادم فايربيس في users/${uid}/cloud_backup.',
        'تبسيط قائمة الشريط الجانبي: إزالة جميع أزرار وأشرطة النسخ الاحتياطي اليدوي من القائمة الجانبية وملف المستخدم بعد أن أصبحت المزامنة والاستعادة آلية بنسبة 100%.',
        'تشغيل التطبيق دون إنترنت ومنع تسجيل الخروج: تفعيل حفظ الجلسة في المتصفح وتخزين نسخة احتياطية من جلسة المستخدم محلياً لضمان عمل التطبيق بكامل وظائفه دون إنترنت وعدم تسجيل الخروج إلا عند النقر اليدوي على تسجيل الخروج.',
        'طابور المزامنة دون اتصال وعامل الخدمة Workbox: حفظ التحديثات السحابية ومساحات المشاركة محلياً أثناء انقطاع الشبكة ومزامنتها فور عودة الاتصال، مع ضبط navigateFallback في Workbox لفتح التطبيق موثوقاً دون اتصال بالإنترنت.',
      ],
    },
  },
  {
    version: '1.1.32',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Space Settings Modal Activation & Multi-Tier 16-Digit User ID Cloud Discovery',
      ar: 'تفعيل نافذة إعدادات المساحة ومحرك البحث السحابي المتقدم للمعرف الرقمي المكون من 16 رقماً',
    },
    highlights: {
      en: [
        'Space Settings Modal Activation (⚙️): Fixed popstate listener conflicts and elevated the settings modal to high-priority z-[95] and emoji picker to z-[105], allowing smooth editing of space name, icons, and deletion without accidental closures.',
        'Mandatory Firebase Rule Fields: Ensured all profile publications include { ownerUid, accountName, updatedAt, numericId, name, photoURL } to completely prevent Firebase RTDB PERMISSION_DENIED errors, and persisted numeric16Id under users/${uid}/profile.',
        'Instant Startup & Modal Cloud Registration: Automatically registers authenticated user profiles to Firebase RTDB on app startup, as well as on opening UserProfileModal, SharedAccountsHubModal, or ShareFolderModal without requiring re-login.',
        'Multi-Tier 16-Digit ID Discovery: Enhanced the lookup engine to query shared_accounts/profile_${clean16Id} first with graceful fallbacks to numericIds, shared_accounts entries, and users records, ensuring all 16-digit IDs are found with real-time self-healing.',
      ],
      ar: [
        'تفعيل نافذة إعدادات المساحة (⚙️): حل مشكلة تعارض استماع زر الرجوع ورفع طبقة نافذة الإعدادات إلى z-[95] ومنتقي الإيموجي إلى z-[105]، مما يتيح تعديل اسم المساحة وتغيير أيقونتها أو حذفها بسلاسة.',
        'حقول قواعد أمان فايربيس الإلزامية: تضمين كامل الحقول المطلوبة (ownerUid و accountName و updatedAt و numericId و name و photoURL) لمنع رفض الكتابة بخطأ PERMISSION_DENIED وحفظ المعرف الرقمي في ملف المستخدم.',
        'تسجيل سحابي تلقائي عند البدء والنوافذ: تسجيل بطاقة المستخدم العامة فوراً عند بدء التطبيق وعند فتح نوافذ الملف الشخصي، مساحات المشاركة، أو نافذة المشاركة دون الحاجة لإعادة تسجيل الدخول.',
        'محرك بحث متعدد الطبقات للمعرف الرقمي: فحص مسار shared_accounts/profile أولاً ثم الانتقال تلقائياً إلى numericIds وسجلات المساحات والمستخدمين لضمان العثور على أي حساب مسجل مع استرجاع الصورة والاسم والشفاء الذاتي الفوري.',
      ],
    },
  },
  {
    version: '1.1.31',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Consolidated Release: External Share Web UI, Space Edit Loop Fix, Guest ID Restriction & Sidebar Highlight',
      ar: 'إصدار تجميعي شامل: تحسين صفحة المشاركة الخارجية، إصلاح حلقة تعديل المساحات، حماية حسابات الضيوف وإبراز زر المشاركة',
    },
    highlights: {
      en: [
        'Tablet Landscape & Viewport Mode: Configured universal device orientation ("any") and removed width constraints for smooth landscape viewing.',
        'External Share Header Flexbox Rebuild: Replaced overlapping elements with a structured flexbox header featuring prominent space title and clean refresh actions.',
        'Icon Selector Crash Fix: Added explicit type="button" and event propagation guards to prevent modal dismissals and unexpected form submissions.',
        'Guest User ID Restriction: Prevented 16-digit ID generation and cloud share access for unauthenticated users with a prominent sign-in gate.',
        'Immediate Public Profile Sync: Enforced real-time publishing of user profile cards (numericId, name, avatar, uid) upon authentication to ensure 100% 16-digit discoverability.',
        'Edit Space Popstate Loop Fix: Synchronized and cleared isEditingSpace, editingShareId, and settingsFolder on Back button, Cancel/Save, and component unmount.',
        'Highlighted Sidebar Share Entry: Redesigned the Shared Accounts & Spaces button with distinct primary outline, gradient backdrop, bold icon, and pulsating Live badge.',
      ],
      ar: [
        'دعم الوضع الأفقي والأجهزة اللوحية: ضبط اتجاه العرض الشامل وإزالة القيود العرضية لتوسيع الشاشة بالكامل عند التدوير.',
        'ترويسة مرنة لصفحة المشاركة الخارجية: إعادة بناء ترويسة صفحة الويب بنظام flexbox مع إبراز عنوان المساحة وتثبيت زر التحديث دون أي تداخل.',
        'معالجة تعليق منتقي الأيقونات: إضافة نوع type="button" صراحة وإيقاف انتشار الحدث لمنع إغلاق النوافذ أو إرسال النماذج بالخطأ.',
        'تقييد المعرف الرقمي لحسابات الضيوف: حظر توليد أو عرض المعرف المالي للمستخدمين غير المسجلين وحجب المشاركة السحابية ببطاقة تسجيل دخول بارزة.',
        'مزامنة فورية للهوية عند تسجيل الدخول: نشر وتحديث بطاقة المستخدم العامة فوراً على Firebase RTDB عند تسجيل الدخول لضمان الظهور الفوري في البحث.',
        'إصلاح حلقة تعديل المساحة في زر الرجوع: إعادة تعيين متغيرات isEditingSpace و editingShareId صراحة عند الضغط على زر الرجوع أو الإلغاء/الحفظ.',
        'إبراز زر المشاركة في القائمة الجانبية: تصميم مميز لزر مساحات الحسابات المشتركة بإطار أساسي جذاب وتدرج لوني وشارة بث مباشر.',
      ],
    },
  },
  {
    version: '1.1.30',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Prominent Sidebar Shared Spaces Hub Button Redesign',
      ar: 'إبراز وتحديث زر مساحات الحسابات المشتركة في القائمة الجانبية',
    },
    highlights: {
      en: [
        'Distinct Visual Emphasis: Redesigned the Shared Accounts & Spaces button with an eye-catching gradient tint, primary outline, and dedicated bold icon container.',
        'Two-Tier Information Layout: Added a descriptive subtitle highlighting real-time collaboration & 16-digit sync alongside a pulsating Live status badge.',
        'Enhanced Spacing & Accessibility: Expanded button padding and separation to ensure it is never cramped or lost among standard menu items.',
      ],
      ar: [
        'إبراز بصري مميز: إعادة تصميم زر مساحات الحسابات المشتركة بتدرج لوني جذاب وإطار أساسي بارز وأيقونة واضحة مميزة.',
        'تصميم معلوماتي من مستويين: إضافة نص فرعي يوضح المزامنة الحية والتعاون بالمعرف الرقمي مع شارة بث مباشر نابضة.',
        'أبعاد وتناسق محسّن: توسيع هوامش وأبعاد الزر لمنع انحشاره أو ضياعه بين عناصر القائمة الجانبية الأخرى.',
      ],
    },
  },
  {
    version: '1.1.29',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Edit Space Loop Fix & Popstate Navigation State Guard',
      ar: 'معالجة حلقة تعديل المساحة اللانهائية وتثبيت حالة التنقل بالزر الخلفي',
    },
    highlights: {
      en: [
        'Popstate Navigation Safety: Explicitly reset isEditingSpace, editingShareId, and settingsFolder to false/null in popstate handlers and component unmount cleanups.',
        'Eliminated Modal Re-open Loop: Prevented the Edit Space dialog from erroneously re-opening upon re-entering the Shared Spaces Hub or pressing the hardware Back button.',
        'Coordinated App-Level Hierarchy: Unified back-button priority chain so pressing hardware Back dismisses active space settings first before affecting underlying hub views.',
      ],
      ar: [
        'أمان التنقل بالزر الخلفي: إعادة تعيين isEditingSpace و editingShareId و settingsFolder صراحة إلى false/null في مراقبات popstate وعند إلغاء تحميل المكونات.',
        'القضاء على التكرار التلقائي: منع نافذة تعديل المساحة من الفتح التلقائي عند الدخول مجدداً إلى مركز المشاركة أو الضغط على زر الرجوع.',
        'تسلسل هرمي موحد للتنقل: إغلاق نافذة إعدادات المساحة أولاً بشكل مستقل دون الخروج المفاجئ من مركز المشاركة أو إعادة توجيه الصفحة الرئيسية.',
      ],
    },
  },
  {
    version: '1.1.28',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Immediate Public Profile Sync on Auth State Change for 16-Digit Search Discoverability',
      ar: 'مزامنة فورية للملف الشخصي العام عند تسجيل الدخول لضمان الظهور في بحث الـ 16 رقماً',
    },
    highlights: {
      en: [
        'Immediate Profile Sync: Every time a user authenticates, their public profile (numericId, name, avatar, photoURL, and uid) is instantly published to Firebase RTDB at shared_accounts/profile_${cleanMy16Id}.',
        'Flawless 16-Digit Discovery: Guarantees that newly registered or signed-in users are immediately discoverable by recipient verification searches in Share Spaces.',
        'Unified Auth State Listener: Streamlined auth identity resolution into a single source of truth without race conditions or redundant handlers.',
      ],
      ar: [
        'مزامنة فورية للهوية العامة: مع كل تسجيل دخول، يتم نشر وتحديث بيانات المستخدم العامة (المعرّف الرقمي، الاسم، الرمز التعبيري، الصورة، والـ uid) فوراً في Firebase RTDB تحت shared_accounts/profile_${cleanMy16Id}.',
        'اكتشاف فوري للمستخدمين: ضمان ظهور جميع المستخدمين المسجلين فوراً في فحص وبحث الـ 16 رقماً داخل مركز المشاركة دون رسائل "لم يتم العثور".',
        'توحيد مراقب حالة المصادقة: دمج منطق معالجة هوية المستخدم في نقطة مركزية واحدة تضمن السرعة والاستقرار وتمنع التضارب.',
      ],
    },
  },
  {
    version: '1.1.27',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Strict Guest Mode Isolation: 16-Digit ID & Cloud Share Authentication Gate',
      ar: 'عزل حسابات الضيوف وتقييد المعرّف المالي والمشاركة السحابية بالمصادقة',
    },
    highlights: {
      en: [
        'Guest ID Prevention: Strictly prevent generation, display, or storage of 16-digit numeric IDs for guest users not authenticated with Firebase Auth.',
        'Prominent Sign-In Gate: Display a clear and prominent "Sign in required" blocking card across the Share Hub and Profile modal when accessed in guest mode.',
        'Protected Cloud Features: Hide all share space creation, member invitations, and inbox listeners until authentication is completed.',
      ],
      ar: [
        'منع توليد المعرّف للضيوف: حظر توليد أو عرض أو حفظ المعرّف الرقمي المكون من 16 رقماً للمستخدمين غير المسجلين عبر Firebase.',
        'شاشة تنبيه بارزة لتسجيل الدخول: عرض بطاقة تنبيهية واضحة ومباشرة تلزم تسجيل الدخول في مركز المشاركة والملف الشخصي في وضع الضيف.',
        'حماية ميزات المشاركة السحابية: إخفاء إنشاء مساحات المشاركة ودعوات الأعضاء ومزامنة الصندوق حتى إتمام تسجيل الدخول.',
      ],
    },
  },
  {
    version: '1.1.26',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Icon Selector Form Submission Fix with type="button" & Safe Emoji Selection',
      ar: 'معالجة إغلاق النوافذ غير المقصود في منتقي الأيقونات وتثبيت نوع الزر type="button"',
    },
    highlights: {
      en: [
        'Form Submission Protection: Explicitly added type="button", preventDefault, and stopPropagation to the "Show more" button in icon selectors.',
        'Stable Modal Interaction: Prevented accidental modal dismissals or form submissions when expanding full icon grids in Share Spaces and Categories.',
        'Consistent Icon Grids: Standardized quick-select icon rows with safe click handling across all creation and settings dialogs.',
      ],
      ar: [
        'حماية من الإرسال التلقائي للنماذج: إضافة نوع type="button" صراحة مع إيقاف انتشار الحدث لزر "عرض المزيد" في منتقي الأيقونات.',
        'استقرار نوافذ المشاركة والفئات: منع إغلاق أو إرسال النوافذ المنبثقة بالخطأ عند طلب استعراض كافة الرموز التعبيرية.',
        'مصفوفة أيقونات متسقة: توحيد سلوك اختيار الأيقونات السريعة عبر مساحات المشاركة والفئات والحسابات.',
      ],
    },
  },
  {
    version: '1.1.25',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'External Share Flexbox Header with Centered Space Title & Clean Refresh Placement',
      ar: 'شريط ترويسة مرن لصفحة المشاركة الخارجية بعنوان مركزي وتثبيت أنيق لزر التحديث',
    },
    highlights: {
      en: [
        'Clean Flexbox Header: Rebuilt StandaloneShareView header as a structured flexbox container without absolute positioning conflicts.',
        'Prominent Space Name Heading: Centered the actual Share Space title and icon prominently with subtle owner & sync timestamps.',
        'Zero-Overlap Refresh Action: Neatly positioned the live Refresh button on the far right alongside quick export and action controls.',
      ],
      ar: [
        'ترويسة مرنة ومنظمة: إعادة بناء شريط الترويسة في StandaloneShareView بنظام flexbox دون أي تداخل أو تموضع مطلق.',
        'إبراز عنوان مساحة المشاركة: توسيط اسم مساحة المشاركة وأيقونتها بشكل بارز مع معلومات المالك وتوقيت المزامنة.',
        'زر تحديث مرتب بدون تداخل: وضع زر التحديث الحي في أقصى اليمين بشكل أنيق ومستقل إلى جانب أدوات المشاركة والتصدير.',
      ],
    },
  },
  {
    version: '1.1.24',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Tablet & Landscape Full-Width Expansion & Viewport Resizing',
      ar: 'توسيع كامل العرض للأجهزة اللوحية والوضع الأفقي وإتاحة تغيير حجم العرض',
    },
    highlights: {
      en: [
        'Unconstrained Landscape Mode: Removed narrow mobile max-width bottlenecks across App, Views, and Navigation bars so content expands fluidly to full screen width (up to max-w-7xl) on tablets and foldables.',
        'Resizable Viewport: Updated index.html viewport meta tag to enable natural browser resizing and rotation transitions without restrictive zoom/scaling locks.',
        'Orientation Consistency: Manifests strictly configured with "orientation": "any" for PWA desktop and tablet installs.',
      ],
      ar: [
        'توسيع شامل للوضع الأفقي: إزالة القيود الضيقة للعرض عبر الحاوية الرئيسية والصفحات وأشرطة التنقل ليتسع المحتوى بكامل عرض الشاشة على الأجهزة اللوحية والشاشات القابلة للطي.',
        'تكييف وتدوير مرن: تحديث وسم viewport في index.html لتمكين التدوير الطبيعي وتغيير الحجم دون قيود صارمة على التحجيم.',
        'تثبيت اتجاه حر: ضبط ملفات تعريف PWA بدقة على "orientation": "any" لضمان حرية التدوير على أجهزة التابلت والكمبيوتر.',
      ],
    },
  },
  {
    version: '1.1.23',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Smart Share Spaces, Live 16-Digit Verification, Timeline Grouping & Tablet Landscape',
      ar: 'مساحات المشاركة الذكية، التحقق اللحظي بالمعرّف الرقمي، التجميع الزمني، ودعم دوران الأجهزة اللوحية',
    },
    highlights: {
      en: [
        'Tablet & Landscape Freedom: Full auto-rotation with "orientation: any", responsive landscape modals and scrollable views without forced vertical orientation.',
        'Clean Search Feed: Streamlined transaction rows hiding account badges in search and filtered results for distraction-free expense lookup.',
        'Live 16-Digit User Lookup: Instant numeric profile verification with avatar photo and full name preview card before sending share invites.',
        'Dual Real-Time & 4s Polling Sync: Reliable cloud delivery ensuring invites and changes appear automatically in member inboxes and shared views.',
        'External Share Live Streaming: Standalone share links (?share=...) stream directly from Firebase RTDB with a 5-second polling fallback without manual refresh.',
        'Dedicated Space Settings (⚙️): Full control to rename spaces, select custom emojis/icons, or permanently delete the share space across all members.',
        'Home-Style Grouped Timeline: Shared transactions grouped by months and days with date headers, daily/monthly net totals, and collapsible blocks.',
        'Included Entities & Overlap Deletion: Dedicated bar for included accounts and categories with inspection filtering, plus Pre-Delete Review with overlap warnings and automatic cleanup of empty entities.',
      ],
      ar: [
        'حرية التدوير للأجهزة اللوحية: دعم كامل للشاشات الأفقية واللوحية مع "orientation: any" وتكييف النوافذ المنبثقة دون قفل الاتجاه الرأسي.',
        'سجل بحث نقي: إخفاء شارة الحساب من نتائج البحث والمعاملات المصفاة لتجربة تصفح نظيفة ومركزة.',
        'تحقق لحظي للمستخدم بالمعرّف 16 رقم: فحص فوري للملف الشخصي مع عرض صورة الحساب والاسم الحقيقي قبل إرسال الدعوة للشير.',
        'مزامنة سحابية مزدوجة مع فحص كل 4 ثوانٍ: وصول فوري لدعوات ومستجدات المشاركة إلى صناديق الأعضاء بدون الحاجة لإجراء يدوي.',
        'بث حي لصفحات المشاركة الخارجية: روابط الشير الخارجية (?share=...) تبث البيانات مباشرة من السحابة مع تحديث خلفي كل 5 ثوانٍ.',
        'إعدادات مساحة المشاركة (⚙️): إمكانية تعديل اسم المساحة، اختيار أيقونة مخصصة، أو حذف مساحة المشاركة نهائياً من كافة الأجهزة.',
        'جدول زمني مجمع مماثل للشاشة الرئيسية: تجميع معاملات الشير بالشهور والأيام مع فواصل التواريخ والمجاميع اليومية والشهرية.',
        'شريط العناصر المضمنة ومراجعة التداخل: قسم مخصص للحسابات والتصنيفات مع ميزة التصفية، ونافذة مراجعة ذكية تكشف المعاملات المشتركة قبل الحذف مع تنظيف تلقائي للعناصر الفارغة.',
      ],
    },
  },
  {
    version: '1.1.22',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Share Space Settings Modal (Rename, Icon Selector & Full Deletion)',
      ar: 'نافذة إعدادات مساحة المشاركة (تعديل الاسم، اختيار الأيقونة، والحذف الشامل)',
    },
    highlights: {
      en: [
        'Dedicated Share Space Settings (⚙️): Easily accessible in both Share Detail View and Shared Accounts Hub for share owners.',
        'Rename & Icon Customization: Rename any share space and choose from curated popular icons or the complete emoji picker with real-time cloud sync.',
        'Full Permanent Deletion: Safely remove the space from local storage, delete shared_accounts/share_${shareId} from Firebase RTDB, and clear all invite records from invited members\' inboxes.',
      ],
      ar: [
        'نافذة مخصصة لإعدادات المساحة (⚙️): متوفرة لمالك الشير من صفحة التفاصيل ومن مركز الحسابات المشتركة.',
        'تعديل الاسم وتغيير الأيقونة: إمكانية تغيير اسم المساحة واختيار أيقونة من قائمة الأيقونات الشائعة أو من نافذة الرموز الكاملة مع مزامنة سحابية لحظية.',
        'حذف شامل ونهائي: حذف مساحة المشاركة من التطبيق، ومسحها من خوادم فايربيس السحابية، وإلغاء وصول جميع الأعضاء ومسح السجل من صناديقهم نهائياً.',
      ],
    },
  },
  {
    version: '1.1.20',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Real-Time External Share Streaming & 5-Second Cloud Polling Fallback',
      ar: 'بث سحابي فوري لصفحات المشاركة الخارجية وتحديث دوري كل 5 ثوانٍ',
    },
    highlights: {
      en: [
        'Live Real-Time Streaming: Standalone external share pages (?share=...) always prioritize real-time streaming directly from Firebase RTDB at shared_accounts/share_${shareId} via onValue().',
        'Automatic 5-Second Periodic Polling: Continually checks and synchronizes live share updates every 5000ms in the background, keeping mobile and background browser tabs updated without manual refresh.',
        'Offline Fallback Snapshot: The URL &data= snapshot parameter is strictly preserved as an offline fallback when internet or cloud servers are unreachable, and stripped from the address bar to prevent stale browser cache.',
        'Instant Cloud Push on Any Modification: Every transaction add/edit, item removal, or share setting modification immediately broadcasts the updated snapshot to shared_accounts/share_${shareId}.',
      ],
      ar: [
        'بث سحابي فوري ومباشر: صفحات المشاركة الخارجية المفتوحة عبر الروابط المباشرة تعتمد دائماً على البث اللحظي من خوادم فايربيس على مسار shared_accounts/share_${shareId} باستخدام onValue().',
        'تحديث خلفي دوري كل 5 ثوانٍ: فحص ومزامنة تلقائية كل 5000ms لضمان وصول التعديلات والإضافات للمتصفحات الخارجية والهواتف دون الحاجة لأي تحديث يدوي.',
        'نسخة احتياطية ذكية بدون إنترنت: استخدام معامل الرابط &data= كخيار احتياطي فقط عند انقطاع الاتصال بالسيرفر، مع تنظيف الرابط من شريط المتصفح لمنع تجميد البيانات القديمة.',
        'مزامنة سحابية فورية لكافة التعديلات: إضافة أو تعديل أو حذف أي معاملة أو عنصر داخل الشير يرسل التحديث لحظياً إلى خوادم السحابة ليظهر فوراً لجميع المشاهدين.',
      ],
    },
  },
  {
    version: '1.1.19',
    releaseDate: 'October 22, 2026',
    title: {
      en: 'Reliable 16-Digit Share Delivery via Server Sync & Dual Real-Time + 4s Polling',
      ar: 'تسليم ومزامنة فورية للشير الرقمي عبر الخادم مع استماع لحظي وتحديث دوري كل 4 ثوانٍ',
    },
    highlights: {
      en: [
        'Guaranteed Share Delivery: Adding a user or updating a share immediately writes full share payloads with all required Firebase rule fields (ownerUid, accountName, updatedAt: Date.now(), and invites map) to shared_accounts/share_${shareId} and shared_accounts/inbox_${targetClean16Id}.',
        'Dual Real-Time + 4-Second Polling: Combines live Firebase onValue listeners with an automatic 4000ms periodic background polling loop in both Share Hub and Share Detail views so incoming shares and changes appear without manual refresh.',
        'Resilient Metadata Parsing: Automatically filters out rule metadata properties and reconstructs full share spaces and member rosters from cloud snapshots.',
      ],
      ar: [
        'تسليم مضمون للمشاركات الرقمية: عند إضافة مستخدم أو تحديث الشير، تتم كتابة كامل بيانات الشير مع حقول قواعد فايربيس الإلزامية (ownerUid وaccountName وupdatedAt وخريطة invites) على مسارات shared_accounts/share_${shareId} وshared_accounts/inbox_${targetClean16Id}.',
        'مزامنة مزدوجة: استماع لحظي onValue مع حلقة استعلام دورية كل 4 ثوانٍ (4000ms) في صفحة المشاركات وصفحة تفاصيل الشير لظهور الدعوات والتحديثات تلقائياً دون الحاجة لإعادة تحميل الصفحة.',
        'معالجة ذكية للبيانات الواردة: فلترة حقول القواعد الإلزامية وإعادة بناء عناصر الشير وقوائم الأعضاء بدقة متناهية من الخادم.',
      ],
    },
  },
  {
    version: '1.1.18',
    releaseDate: 'October 21, 2026',
    title: {
      en: 'Live 16-Digit User Lookup & Verification Preview Before Adding to Share',
      ar: 'تحقق ومعاينة تفاعلية فورية للمستخدم بالمعرّف الرقمي قبل إضافته للشير',
    },
    highlights: {
      en: [
        'Live 16-Digit User Lookup: The instant 16 numeric digits are entered, a real-time verification query checks Firebase RTDB at shared_accounts/profile_${clean16Id} with an animated spinner, keeping Add/Invite buttons disabled until verification succeeds.',
        'Verified User Preview Card: Displays the verified user\'s photo/avatar, full name, formatted 16-digit ID, and verified status badge, enabling the Add/Invite button for explicit confirmation.',
        'Clear User Not Found Handling: Unregistered IDs display an instant, clear "User not found" alert while keeping the action button safely disabled.',
        'Automatic Identity Publishing & Sync: All signed-in users automatically sync and publish their real full name and avatar photo to shared_accounts/profile_${myClean16Id} so senders and recipients always see each other\'s real identity.',
      ],
      ar: [
        'تحقق مباشر وفوري بالمعرّف الرقمي: بمجرد إدخال 16 رقماً، يتم الاستعلام اللحظي من خوادم Firebase RTDB على مسار shared_accounts/profile_${clean16Id} مع مؤشر فحص متحرك، مع إبقاء زر الإضافة معطلاً لحين إتمام التحقق.',
        'بطاقة معاينة المستخدم المعتمد: عرض صورة/أيقونة المستخدم واسمه الكامل وحالته المعتمدة فور العثور عليه، وتفعيل زر الإضافة/الدعوة لتمكين التأكيد بثقة.',
        'تنبيه واضح عند عدم وجود المستخدم: في حال إدخال معرّف غير مسجل، يظهر تنبيه صريح "لم يتم العثور على المستخدم" مع إبقاء الزر معطلاً منعاً للأخطاء.',
        'مزامنة ونشر الهوية تلقائياً: كل مستخدم مسجل يتم نشر وتحديث اسمه الحقيقي وصورة حسابه تلقائياً في خوادم الفايربيس ليظهر الاسم والصورة الحقيقية لدى الطرفين دائماً.',
      ],
    },
  },
  {
    version: '1.1.17',
    releaseDate: 'October 21, 2026',
    title: {
      en: 'Clean Search Results, Real-Time Transaction Search & Account Badge Removal',
      ar: 'نتائج بحث نقية، شريط بحث فوري في المعاملات، وإزالة شارة اسم الحساب',
    },
    highlights: {
      en: [
        'Clean Search & Filtered Rows: Fully hid and removed Account Name badges and labels from transaction rows in search results and filtered lists, displaying cleanly only the category icon/name, note, date, and amount.',
        'Real-time Transaction Search Bar: Added an instant, responsive search bar to HomeView allowing users to search transactions live by note/description, category name, date, or amount with quick clear actions.',
        'Advanced Filter Keyword Search: Integrated keyword and note search capability into AdvancedFilterModal and AppContext for deep multi-criteria transaction queries.',
        'Transfer Title Cleaning: Transfers in search and filtered results now display clean notes and transfer labels instead of showing account names in the title.',
      ],
      ar: [
        'نتائج بحث وتصفية نقية: إخفاء وإزالة شارة واسم الحساب بالكامل من صفوف المعاملات في نتائج البحث وقوائم التصفية، لتعرض المعاملة بنقاء أيقونة واسم الفئة، الملاحظة، التاريخ، والمبلغ فقط.',
        'شريط بحث فوري في المعاملات: إضافة شريط بحث سريع في الصفحة الرئيسية للبحث اللحظي في المعاملات بالملاحظة أو الفئة أو التاريخ أو المبلغ مع زر مسح سريع وعداد للنتائج.',
        'البحث بالكلمات في الفلتر المتقدم: إضافة حقل بحث بالملاحظات والكلمات المفتاحية داخل نافذة الفلتر المتقدم لتصفية مخصصة وعميقة.',
        'تنقية عناوين التحويلات: معاملات التحويل في البحث والتصفية تعرض الآن تصنيف وملاحظة التحويل بدلاً من إظهار أسماء الحسابات في العنوان.',
      ],
    },
  },
  {
    version: '1.1.16',
    releaseDate: 'October 21, 2026',
    title: {
      en: 'Tablet & Landscape Orientation Unlock, Universal Responsive Modals & PWA Manifest Standardization',
      ar: 'إلغاء قفل التدوير للشاشات الكبيرة والتابلت، تكييف النوافذ المنبثقة للوضع الأفقي، وتوحيد ملفات الـ PWA',
    },
    highlights: {
      en: [
        'Universal Orientation Support: Completely removed orientation constraints across public/manifest.json, manifest.webmanifest, vite.config.ts, and index.html, setting orientation: "any" so the app rotates fluidly between Portrait and Landscape on all tablets, foldables, and desktop displays.',
        'Adaptive Responsive Modals: Re-engineered all 20+ modal windows with dynamic viewport heights (max-h-[92dvh]), auto-centering, landscape-specific padding, and smooth vertical scrolling to eliminate overflow and cut-offs.',
        'Dynamic Viewport (100dvh) Root Layout: Updated App viewport container to min-h-[100dvh] ensuring seamless adjustments when browser bars retract during screen rotation.',
        'Standalone PWA Manifests: Explicitly generated and linked public/manifest.json and manifest.webmanifest with "orientation": "any" for flawless system-level installation.',
      ],
      ar: [
        'دعم كامل وغير مقيد لتدوير الشاشة: إزالة أي قيود رأسية في ملفات manifest.json و manifest.webmanifest و vite.config.ts و index.html مع ضبط التدوير على "any" ليدعم الدوران السلس بين الوضعين الأفقي والرأسي على الأجهزة اللوحية والقابلة للطي والكمبيوتر.',
        'تكييف ذكي للنوافذ المنبثقة: إعادة هندسة أكثر من 20 نافذة منبثقة بنظام ارتفاع ديناميكي (max-h-[92dvh]) وتمركز تلقائي وهوامش خاصة بالوضع الأفقي مع تمرير رأسي انسيابي يمنع أي اقتطاع.',
        'تصميم حاوية ديناميكي (100dvh): تحديث إطار التطبيق الجذري ليعتمد على min-h-[100dvh] ليتكيف بدقة مع ظهور واختفاء أشرطة المتصفح والنظام عند التدوير.',
        'توحيد ملفات تعريف الـ PWA: إنشاء وربط ملفات manifest.json و manifest.webmanifest المحدثة لضمان التثبيت المستقل بأفضل أداء.',
      ],
    },
  },
  {
    version: '1.1.15',
    releaseDate: 'October 21, 2026',
    title: {
      en: 'Landscape Mode, Big-Screen UI, Verified User ID Search, Direct Share Delivery & Leave Anytime',
      ar: 'دعم الوضع الأفقي والشاشات الكبيرة، البحث التفاعلي عن المستخدم، تسليم الشير المباشر وإمكانية المغادرة في أي وقت',
    },
    highlights: {
      en: [
        'Full Landscape & Big-Screen Compatibility: Removed portrait-lock constraints (orientation: "any"), making the app freely rotatable and beautifully responsive on tablets, Chromebooks, laptops, and desktop screens with side-by-side calendar views and 4-column grids.',
        'Interactive User ID Search & Profile Discovery: Entering a 16-digit ID automatically verifies and displays the user profile card with their avatar photo and full name, allowing instant selection before sharing.',
        'Zero-Pending Instant Share Delivery: Sharing and invitations now activate immediately with accepted status, appearing directly in "Shared with Me" without requiring pending acceptance.',
        'Leave Share Anytime: Non-owners can leave any shared space anytime with a single tap from the header, member list, or shared spaces hub.',
        'Instant Fallback Snapshot & Auto-Save for Links: External web share links open in 0ms using embedded base64 fallback snapshots with parallel cloud sync, and automatically save into the user\'s "Shared with Me" tab.',
        'Join via Link or Share ID: Added a dedicated input bar in the Shared Spaces Hub allowing users to paste any share URL or ID to join instantly.',
      ],
      ar: [
        'دعم كامل للوضع الأفقي والشاشات الكبيرة: إلغاء القفل الرأسي (orientation: "any") وتكييف كافة الواجهات بذكاء للشاشات العريضة والتابلت (عرض التقويم مع المعاملات جنباً إلى جنب، وشبكة حسابات وميزانية من 4 أعمدة).',
        'بحث تفاعلي بالمعرّف الرقمي واكتشاف الملف الشخصي: عند إدخال المعرّف (16 رقماً) يتم البحث والتحقق التلقائي وعرض بطاقة المستخدم مع صورته واسمه لاختياره بثقة قبل إرسال الشير.',
        'تسليم فوري للشير بدون انتظار (إلغاء وضع المعلق): إرسال الشير يفعله مباشرة كشير نشط ومقبول فوراً ويظهر في تبويب "المشارَك معي" دون الحاجة لخطوات قبول أو انتظار.',
        'إمكانية مغادرة الشير في أي وقت: يمكن للأعضاء مغادرة أي شير بضغطة زر وتأكيد سريع من شريط العنوان العلوي أو قائمة الأعضاء أو مركز الشير.',
        'روابط مشاركة فورية بلقطة بيانات احتياطية: تفتح روابط الويب الخارجية في 0ms دون أي خطأ في الاتصال، مع حفظها تلقائياً في قائمة "المشارَك معي" للمستلم.',
        'الانضمام عبر رابط أو كود شير: شريط جديد في مركز الشير يتيح للمستخدم لصق أي رابط مشاركة أو كود والانضمام إليه وفتحه في لحظتها.',
      ],
    },
  },
  {
    version: '1.1.14',
    releaseDate: 'October 21, 2026',
    title: {
      en: 'Instant Account Multi-Select, 4-Digit Smart ID Formatting, Dedicated Share Deletion Modal & Scroll-Lock Polish',
      ar: 'تحديد فوري للحسابات لحظياً، تقسيم ذكي للمعرف الرقمي كل 4 أرقام، نافذة مخصصة لحذف معاملات الشير، وإصلاح قفل التمرير',
    },
    highlights: {
      en: [
        'Instant Account Multi-Selection: Tapping account cards while in select mode toggles selection immediately (0ms delay) with instant checkmark feedback and action-bar synchronization, eliminating the need to switch tabs.',
        'Smart 4-Digit ID Partitioning: All 16-digit ID inputs across the app format numbers automatically into 4-digit blocks (XXXX XXXX XXXX XXXX) with smooth backspace handling across chunk boundaries.',
        'Dedicated Share Transaction Deletion Modal: Purpose-built dialog providing explicit choices ("Remove from Share Only" vs "Delete Everywhere"), a top-corner close (X) button, an explicit Cancel & Exit button, and backdrop tap dismissal.',
        'Zero Ghost-Modal Scroll Locks: Resolved dangling transaction edit state (editingTx) on modal close, ensuring background page scrolling and navigation bars remain 100% responsive without requiring back button resets.',
        'Universal Dialog Exit Controls: Added top-corner exit (X) buttons and backdrop click-to-dismiss to all system confirmation and prompt dialogs.',
      ],
      ar: [
        'تحديد فوري للحسابات بدون تأخير: الضغط على بطاقة الحساب في وضع التحديد المتعدد ينفذ الاختيار لحظياً ويظهر علامة الصح فوراً في قائمة العناصر وشريط الإجراءات دون الحاجة لتبديل الصفحة.',
        'تقسيم ذكي للمعرّف الرقمي (كل 4 أرقام): تنسيق تلقائي فوري للمعرّفات المكونة من 16 رقماً إلى مجموعات رباعية (XXXX XXXX XXXX XXXX) في جميع النوافذ مع حذف ذكي وسلس للمسافات عند الضغط على Backspace.',
        'نافذة مخصصة لخيارات حذف معاملات الشير: نافذة مستقلة بخيارات واضحة ("إزالة من الشير فقط" أو "حذف نهائي من كل مكان") مع زر إغلاق (X) علوي، وزر إلغاء وخروج صريح، وإمكانية الإغلاق بالنقر على الخلفية.',
        'إزالة تجميد التمرير الخفي: تصفير كامل وتلقائي لحالة التعديل عند إغلاق النوافذ، مما يمنع بقاء الصفحة في حالة قفل التمرير أو إخفاء أشرطة التنقل دون وجود نوافذ مفتوحة.',
        'أزرار إغلاق وخروج لنوافذ التأكيد: إضافة زر إغلاق (X) علوي وإمكانية الإلغاء بالنقر خارج النافذة لكافة نوافذ التأكيد والحوار.',
      ],
    },
  },
  {
    version: '1.1.13',
    releaseDate: 'October 21, 2026',
    title: {
      en: 'Urgent Touch Freeze Hotfix & Safe Background Scroll Discipline for Updates',
      ar: 'إصلاح عاجل لتجميد اللمس والقائمة الجانبية وقفل التمرير خلف نافذة التحديث',
    },
    highlights: {
      en: [
        'Zero Touch Interference: Eliminated pointer-events blocking and fixed-body constraints, restoring instant responsiveness to Sidebar and all modal touch interactions.',
        'Isolated Scroll Containment: Background scrolling is locked strictly at the active tab container level without degrading viewport or touch mechanics.',
        'Update Modal Scroll Discipline: The automatic "What\'s New" version update modal now safely locks background page scroll and stacks at Layer 7.',
        'Reliable Dismissal: Version update modal and all dialogs close cleanly with immediate state restoration.',
      ],
      ar: [
        'استعادة فورية لحرية اللمس: إزالة قيود مؤشرات اللمس والتثبيت القسري للجسم واستعادة الاستجابة الكاملة للقائمة الجانبية والنوافذ.',
        'قفل تمرير معزول وآمن: قفل التمرير الخلفي محصور بحاوية التبويب النشط فقط دون التأثير على إمكانية لمس الشاشة أو النوافذ.',
        'انضباط تمرير نافذة التحديث: نافذة "ما الجديد / تحديث الإصدار" التلقائية تقفل التمرير الخلفي بأمان وتعمل في الطبقة 7.',
        'إغلاق سلس وموثوق: إغلاق فوري وسلس لنافذة التحديث وكافة النوافذ بأزرار الإغلاق وزر الرجوع.',
      ],
    },
  },
  {
    version: '1.1.12',
    releaseDate: 'October 21, 2026',
    title: {
      en: 'Cross-Tab Multi-Select Overhaul, Comprehensive Scroll-Lock Discipline, Real-Time Request Revocation, and Resilient 16-Digit Cloud Synchronization',
      ar: 'إصلاح التحديد المتعدد عبر التبويبات، انضباط قفل التمرير التام خلف النوافذ، إلغاء فوري لطلبات المشاركة، ومزامنة سحابية فائقة للأرقام التعريفية',
    },
    highlights: {
      en: [
        'Seamless Cross-Tab Multi-Select: Directly toggle account selection in AccountsView without card click conflicts while multi-select mode is active.',
        'Bulletproof Background Scroll Lock: Body and underlying views remain completely locked during all open modals, sheets, and review overlays.',
        'Visual Operation Progress Bar: Real-time dynamic stage and percentage indicators (0% to 100%) with 10-second timeout fallbacks.',
        'Strict 8-Layer Z-Index Hierarchy: Cohesive layer distribution ensuring toasts and modals never render underneath parent containers.',
        'Hardware Back-Button LIFO Traversal: Predictable layer-by-layer dismissal of nested dialogs without dismissing parent views prematurely.',
        'Immutable 16-Digit ID Preservation: Guarantees your generated 16-digit financial code persists seamlessly across local and authenticated cloud sessions.',
        'Real-Time Member & Invitation Cancellation: Instantly revoke pending share invites or alter member permissions with live feedback.',
        'Standalone External Share Dashboard: Interactive external sharing link with collapsible account breakdown and zero mandatory sign-in friction.',
      ],
      ar: [
        'تحديد متعدد سلس عبر كافة التبويبات: تحديد الحسابات بلمسة واحدة مباشرة من شاشة الحسابات دون تداخل مع فتح تفاصيل الحساب أثناء وضع التحديد.',
        'قفل تمرير صارم خلف النوافذ: ثبات الصفحة الخلفية بالكامل ومنع التمرير غير المقصود عند فتح أي نافذة منبثقة أو لوحة مراجعة.',
        'شريط تقدم مرئي للعمليات: مؤشر مرئي لمراحل العمليات والنسب المئوية (من 0% إلى 100%) مع حماية مهلة 10 ثوانٍ لعمليات المزامنة.',
        'ترتيب طبقات Z-Index الصارم من 8 مستويات: توزيع محكم يضمن عدم اختفاء النوافذ أو الإشعارات تحت القوائم أو الحاويات الأخرى.',
        'إغلاق متسلسل ومنطقي بزر الرجوع (LIFO): إغلاق النوافذ الفرعية طبقة تلو الأخرى دون إغلاق النوافذ الرئيسية مسبقاً.',
        'ثبات المعرّف الرقمي المكون من 16 رقماً: ضمان بقاء الكود المالي ثابتاً وموثوقاً بين الاستخدام المحلي والمزامنة السحابية.',
        'إلغاء فوري للطلبات وإدارة الأعضاء: إمكانية سحب الدعوات المرسلة أو تعديل صلاحيات المشاركين مع استجابة وتحديث فوري.',
        'لوحة مشاركة خارجية مستقلة: واجهة ويب أنيقة ومستقلة لعرض المشاركات مع إمكانية طي وتوسيع الأقسام دون إجبار الزائر على التسجيل.',
      ],
    },
  },
  {
    version: '1.1.11',
    releaseDate: 'October 21, 2026',
    title: {
      en: 'Z-Index Hierarchy Discipline, Standalone Public Read-Only Dashboard, Interactive Action Progress, Cross-Tab Multi-Select Reactivity, & Member Management with Undo',
      ar: 'انضباط طبقات النوافذ والرسائل، لوحة عرض مستقلة للروابط العامة للقراءة فقط، نافذة تقدم تفاعلية للعمليات، تفاعل فوري للتحديد المتعدد بين التبويبات، وإدارة الأعضاء والطلبات مع التراجع',
    },
    highlights: {
      en: [
        'Top-Level Notification Precedence: Toast notifications elevated to z-[9999] so clipboard copy and action alerts are always visible above sidebars and modals.',
        'Strict Modal Hierarchy: Nested modals (e.g. Create Share inside Share Hub) strictly stack at z-[75] above parent dialogs at z-[60] without hiding underneath.',
        'Interactive Operation Progress: Visual step-by-step progress modal displaying live stages and percentage completion during share creation and dispatch.',
        'Standalone Read-Only Public Link: External share links (?share=...) open a dedicated read-only financial dashboard without forcing account login or import prompts.',
        'Zero-Bleed Scroll Discipline: Universal body and viewport scroll locking whenever any modal, drawer, or sheet is open.',
        'Instant Multi-Select Reactivity: Seamless cross-tab selection between Home, Budget, and Accounts with instant checkbox toggle response on account cards.',
        'Member Revocation & Temporary Undo: Cancel pending share requests or remove members with instant confirmation and a 5-second undo recovery notice.',
        'Silky Auto-Hide Navigation: Both hide and reveal transitions on top headers and bottom navigation are completely smooth and synchronized (300ms ease-in-out).',
      ],
      ar: [
        'أولوية مطلقة للرسائل التنبيهية (z-[9999]): ظهور إشعارات نسخ الكود والعمليات دائماً فوق القائمة الجانبية وكافة النوافذ دون أن تختفي خلفها.',
        'ترتيب صارم لطبقات النوافذ (z-index): نوافذ المشاركة الجديدة تُفتح دائماً فوق مركز المشاركة دون أن تظهر تحته أو تختفي خلفه.',
        'مؤشر تقدم تفاعلي للعمليات: نافذة تفاعلية توضح كل خطوة ونسبة الإنجاز (25%، 65%، 100%) عند إنشاء ومزامنة المشاركات.',
        'لوحة عرض مستقلة للرابط العام: روابط المشاركة الخارجية تفتح مباشرة لوحة مالية مستقلة للقراءة فقط دون طلب تسجيل أو أزرار إضافة قسرية.',
        'منع تسريب التمرير خلف النوافذ: قفل تام لتمرير الصفحة الخلفية عند فتح أي نافذة منبثقة أو قائمة جانبية مع استعادة موضع التمرير بدقة.',
        'تحديد متعدد فوري بين التبويبات: التنقل بحرية بين الرئيسية والميزانية والحسابات مع استجابة فورية للضغط والتحديد دون تعليق.',
        'إلغاء الطلبات وإدارة الأعضاء مع التراجع: إمكانية إلغاء طلبات المشاركة المرسلة أو استبعاد الأعضاء مع تأكيد وإشعار تراجع مؤقت.',
        'إخفاء وظهور فائق الانسيابية للهيدر والفوتر: تحريك متناسق وناعم بنسبة 100% في الإخفاء والظهور عند التمرير.',
      ],
    },
  },
  {
    version: '1.1.10',
    releaseDate: 'October 21, 2026',
    title: {
      en: 'Header & Navigation Transform Sync, Global Multi-Select & Review, Reactive Account Select, Calculator Caret Fix, Back-Stack Safety & Live Firebase Sharing Overhaul',
      ar: 'مزامنة انسيابية للشريط العلوي والسفلي، تحديد متعدد شامل لجميع الصفحات مع نافذة مراجعة، تفاعل فوري للحسابات، إصلاح مؤشر الحاسبة، تصحيح زر الرجوع، وترقية شاملة لنظام المشاركة الحي',
    },
    highlights: {
      en: [
        'Unblockable Header & Navigation Auto-Hide: Synchronized inline transform on root scroll capture (deltaY > 6 hides, deltaY < -2 returns) across all 5 views with guaranteed 60fps responsiveness.',
        'Zero-Lag Accounts Long-Press: Instant 450ms long-press selection reactivity without UI freezing or stale closure memo blocks.',
        'Global Cross-Tab Multi-Select: Freely switch between Home, Budget, and Accounts with unified item selection and sleek Pre-Action Selection Review Sheet.',
        'Calculator Single Caret Architecture: Radical expressions (√) render strictly one cursor without ghost outer carets.',
        'Hardware Back Navigation Guard: Hierarchical popstate stack closes modals and sub-pages without erroneously resetting active tab to Home.',
        'Real-Time Firebase Sharing Overhaul: Task-style share cards, full native Share Detail View with collapsible accordion accounts/categories, and instantaneous profile and inbox sync via RTDB streams.',
      ],
      ar: [
        'إخفاء وظهور انسيابي ومضمون للهيدر والفوتر: تحريك فوري عبر Inline Transforms عند التمرير لأسفل وظهور فوري عند أي تمرير لأعلى في كافة الواجهات الخمس.',
        'تحديد الحسابات الفوري بدون تجميد: استجابة فورية للضغط المطول 450ms بدون حظر إعادة التصيير وحذف وتحديث فوري للحسابات.',
        'تحديد متعدد شامل لجميع الصفحات: التنقل بحرية بين الرئيسية والميزانية والحسابات مع تحديد مجمع ونافذة مراجعة ذكية للعناصر قبل الحذف أو المشاركة.',
        'إصلاح مؤشر الآلة الحاسبة المزدوج: مؤشر كتابة واحد فقط بدقة داخل وخارج الجذور الرياضية دون أي تكرار.',
        'حماية زر الرجوع الفعلي: إغلاق الصفحات الفرعية والنوافذ خطوة بخطوة مع البقاء في نفس التبويب بدقة متناهية دون القفز للرئيسية.',
        'إعادة بناء شاملة لنظام المشاركة الحي: كروت مشاركة أنيقة، صفحة تفاصيل مخصصة مع أكورديون للحسابات والتصنيفات، وتحديث حي فوري لبيانات الأعضاء عبر Firebase RTDB.',
      ],
    },
  },
  {
    version: '1.1.9',
    releaseDate: 'October 21, 2026',
    title: {
      en: 'Complete Share System Rebuild, Long-Press Multi-Select Fix, Header/Footer Sub-Page Isolation, & Calculator Square Root Polish',
      ar: 'إعادة بناء نظام المشاركة بالكامل (صفحات وقوالب)، إصلاح الضغط المطول للتحديد المتعدد، عزل الهيدر والفوتر عن الصفحات الفرعية، وتحسين جذر الآلة الحاسبة',
    },
    highlights: {
      en: [
        'Complete Share System Architecture: Share Pages & Templates with Add to Existing Share vs Create New Share flows, auto-naming & icon inheritance, member management by 16-digit ID, Shared With Me hub, external web links, and full or selective item imports.',
        'Long-Press Multi-Select Stability: Rock-solid touch/mouse long-press detection on Account cards, Categories, and Transactions with strict click suppression to prevent accidental navigation.',
        'Zero Header/Footer Z-Index Overlap: Floating Header and Bottom Navigation automatically hide when entering sub-pages, modals, or sidebars with an unbreachable z-index hierarchy.',
        'Calculator Square Root Navigation: Square root right-arrow never traps the cursor, allowing smart stepping out of the radical with smooth inline typography.',
      ],
      ar: [
        'نظام مشاركة متكامل كصفحات وقوالب: مشاركة الحسابات والتصنيفات والمعاملات، الإضافة لشير موجود أو إنشاء شير جديد، إدارة الأعضاء بالمعرف الرقمي (16 رقم)، ورابط ويب خارجي وتحديد عناصر مخصصة للاستيراد.',
        'استقرار التحديد بالضغط المطول: دعم قوي وموثوق للضغط المطول على بطاقات الحسابات والتصنيفات والمعاملات مع إلغاء النقر التلقائي لمنع فتح التفاصيل بالخطأ.',
        'منع تداخل الهيدر والفوتر مع الصفحات الفرعية: إخفاء الهيدر وشريط التنقل تماماً عند فتح الصفحات الفرعية أو الإعدادات أو القائمة مع طبقات Z-Index محكمة.',
        'تحسين سهم الجذر في الآلة الحاسبة: عدم احتجاز المؤشر داخل الجذر التربيعي وخروج ذكي بسهم اليمين مع محاذاة بصرية انسيابية.',
      ],
    },
  },
  {
    version: '1.1.8',
    releaseDate: 'October 21, 2026',
    title: {
      en: 'React Hook Error #310 Fix, Synchronized Header & Navigation Slide, Robust Error Boundary',
      ar: 'إصلاح خطأ الهوكس 310 في القائمة والبروفايل، تزامن إخفاء وظهور الهيدر وشريط التنقل، وحماية استقرار التطبيق',
    },
    highlights: {
      en: [
        'React Error #310 Elimination: All hooks in Sidebar, UserProfileModal, and MiniDateTimePicker are declared unconditionally at top level, completely fixing the crash when opening the sidebar or profile.',
        'Synchronized Header & Navigation Slide: Both the top header and bottom navigation bar slide out on downward scroll (deltaY > 6, scrollTop > 40) and return instantly on upward scroll (deltaY < -2, scrollTop <= 20) with synchronized 300ms transitions.',
        'Zero Silent Failures & Error Boundary: Wrapped sidebar and modal triggers in try/catch handlers and integrated a top-level React Error Boundary with user-friendly recovery.',
      ],
      ar: [
        'القضاء على خطأ الهوكس 310: نقل كافة الـ Hooks إلى أعلى المكونات بشكل غير مشروط في القائمة الجانبية والبروفايل ومحدد التاريخ، لمنع انهيار التطبيق تماماً.',
        'تزامن اختفاء وظهور الهيدر والنافيجيشن: اختفاء متزامن للشريط العلوي وشريط التنقل السفلي عند التمرير لأسفل وظهورهما فوراً عند أي تمرير خفيف لأعلى بسلاسة 300ms.',
        'حماية كاملة من الانهيارات المفاجئة: معالجة شاملة للأخطاء بحواجز حماية (Error Boundary) وإشعارات توست واضحة تضمن تجربة مستخدم مستقرة 100%.',
      ],
    },
  },
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
        'Sharing Overhaul & Static Hosting Fix: Offline guest snapshot sharing (?sharedData=...), subpath 404 resolution, and custom multi-account bundles.',
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
        'ترقية المشاركة وحل مسارات الاستضافة الثابتة: مشاركة فورية في وضع الضيف (?sharedData=...) مع حزم مخصصة متعددة الحسابات.',
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
        'Universal Web Deployment Compatibility: Relative base path assets preventing blank screens on custom domains & web hosts.',
        'Unified Feature Directory: Master-Detail directory with step-by-step guides, search, and release notes with fixed badge wrapping.',
        'Smooth Accordion Animations: Fluid height and opacity transitions for all collapsible panels and menus.',
        'Android Hardware Back Button Full Sync: Popstate navigation stack closing modals, drawers, and providing exit confirmation.',
      ],
      ar: [
        'قفل التطبيق بالبصمة ورمز PIN: حماية متكاملة عبر البصمة والتعرف على الوجه ورمز PIN مخصص عند فتح التطبيق والعودة من الخلفية.',
        'تنبيهات الميزانية الذكية: تحذيرات استباقية ومعدل إنفاق عند بلوغ 80% وتجاوز 100% من الميزانية مع شارات تنبيه ذكية.',
        'محرك المعاملات المتكررة: جدولة المعاملات الدورية (يومية، أسبوعية، شهرية، سنوية) مع ترحيل تلقائي وتنبيهات استحقاق.',
        'توافق كامل مع النشر على الويب: مسارات نسبية للأصول لمنع الشاشات البيضاء عند النشر على الاستضافات المختلفة.',
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
      en: 'Income Categories Tab, In-Modal Delete, & Auto-Updater',
      ar: 'تبويب فئات الإيرادات، حذف بدون تجميد، وتحديث تلقائي للتطبيق',
    },
    highlights: {
      en: [
        'Dedicated Income Categories tab in BudgetView so incoming categories are never hidden.',
        'In-modal reliable delete confirmation banner replacing blocked browser confirm dialogs.',
        'Automatic live update checker on every app launch and resume.',
        'Fullscreen standalone WebAPK configuration without browser URL search bar.',
      ],
      ar: [
        'تبويب مخصص للفئات الواردة في الميزانية لتبقى ظاهرة دائماً.',
        'تأكيد حذف داخلي موثوق يحل مشكلة توقف الحذف بالمتصفح.',
        'فاحص تحديثات تلقائي يفحص توفر الإصدارات عند فتح التطبيق.',
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
    id: 'app-updater',
    icon: '🔄',
    category: 'core',
    title: { en: 'Seamless In-App Updates', ar: 'تحديثات تلقائية للتطبيق' },
    description: {
      en: 'Checks for updates on launch and seamlessly applies new releases so you are always on the newest release.',
      ar: 'فحص دوري للإصدارات وتطبيق التحديثات تلقائياً لضمان حصولك على أحدث إصدار.',
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
