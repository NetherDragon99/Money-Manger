import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  Sparkles,
  CheckCircle2,
  History,
  Search,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Eye,
  EyeOff,
  LayoutGrid,
} from 'lucide-react';
import { APP_RELEASE_NOTES, APP_CORE_FEATURES, FeatureItem } from '../utils/appFeatures';
import { CURRENT_APP_VERSION } from '../utils/versionChecker';

interface AppFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppFeaturesModal: React.FC<AppFeaturesModalProps> = ({ isOpen, onClose }) => {
  const { settings } = useApp();
  const isArabic = settings.language === 'ar';

  // Initial Full-View State: selectedId is null by default so user sees full cards
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPeeked, setIsPeeked] = useState(false);

  const filteredFeatures = useMemo(() => {
    if (!searchQuery.trim()) return APP_CORE_FEATURES;
    const q = searchQuery.toLowerCase().trim();
    return APP_CORE_FEATURES.filter((feat) => {
      const title = (isArabic ? feat.title.ar : feat.title.en).toLowerCase();
      const desc = (isArabic ? feat.description.ar : feat.description.en).toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [searchQuery, isArabic]);

  const selectedFeature = useMemo(() => {
    if (!selectedId || selectedId === 'changelog') return null;
    return APP_CORE_FEATURES.find((f) => f.id === selectedId) || null;
  }, [selectedId]);

  const [isClosing, setIsClosing] = useState(false);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleAnimatedClose}
      onTouchMove={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-md overscroll-contain transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-4xl h-[92dvh] sm:h-[86dvh] my-auto flex flex-col rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl text-white overflow-hidden relative transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-zinc-800/80 bg-zinc-900/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {isArabic ? 'دليل الاستخدام ومميزات التطبيق' : 'How to Use & Feature Directory'}
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                {isArabic ? `الإصدار الحالي: Beta v${CURRENT_APP_VERSION}` : `Current Version: Beta v${CURRENT_APP_VERSION}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedId !== null && (
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setIsPeeked(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition cursor-pointer"
                title="Return to Grid"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">{isArabic ? 'عرض الشبكة' : 'Grid View'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAnimatedClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Peek floating restore pill when detail panel is peek-hidden */}
        {selectedId !== null && isPeeked && (
          <button
            type="button"
            onClick={() => setIsPeeked(false)}
            className="absolute top-16 right-4 z-40 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-blue-600 text-white text-xs font-bold shadow-2xl animate-pulse cursor-pointer hover:bg-blue-500 transition"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isArabic ? 'إظهار الشرح والتفاصيل' : 'Show Details Pane'}</span>
          </button>
        )}

        {/* Main Body */}
        {selectedId === null ? (
          /* STATE 1: INITIAL FULL-VIEW STATE (FULL-WIDTH GRID OF CARDS) */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Search Input Bar */}
            <div className="p-4 border-b border-zinc-800/60 bg-zinc-950/60 shrink-0">
              <div className="relative max-w-md mx-auto">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isArabic ? 'ابحث في كافة المميزات والأدلة...' : 'Search all features, guides, and tools...'}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            {/* Grid of Cards across full window */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Release Notes Highlight Card */}
              <div
                onClick={() => setSelectedId('changelog')}
                role="button"
                tabIndex={0}
                className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 via-zinc-900 to-zinc-900/90 border border-blue-500/30 hover:border-blue-400 hover:scale-[1.008] transition cursor-pointer shadow-lg group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xl shadow-inner group-hover:scale-105 transition">
                      <History className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-white group-hover:text-blue-300 transition">
                          {isArabic ? 'سجل التحديثات والإصدارات' : 'Release Notes & Changelog'}
                        </h4>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Beta v{CURRENT_APP_VERSION}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        {isArabic
                          ? 'استعرض كافة التحسينات والتحديثات الجديدة في إصدار التطبيق الأخير.'
                          : 'Explore all updates, bug fixes, and new architecture enhancements.'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-zinc-500 group-hover:text-white transition ${isArabic ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Core Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {filteredFeatures.map((feat) => (
                  <div
                    key={feat.id}
                    onClick={() => setSelectedId(feat.id)}
                    role="button"
                    tabIndex={0}
                    className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700 hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer flex flex-col justify-between group shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl group-hover:scale-110 transition shadow-inner">
                          {feat.icon}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-950 text-zinc-400 border border-zinc-800">
                          {feat.category}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition leading-snug">
                        {isArabic ? feat.title.ar : feat.title.en}
                      </h4>
                      <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                        {isArabic ? feat.description.ar : feat.description.en}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-800/50 text-[11px] font-semibold text-blue-400">
                      <span>{isArabic ? 'عرض الشرح التفصيلي' : 'View Full Guide'}</span>
                      <ChevronRight className={`w-3.5 h-3.5 ${isArabic ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* STATE 2: SELECTED SIDE-BY-SIDE STATE (RESPONSIVE SIDE-STRIP + DETAILS WINDOW - Item 18) */
          <div className="flex-1 flex min-h-0 overflow-hidden relative">
            {/* Side Strip: expands on Peek so titles and descriptions are readable with zero blank gap */}
            <div
              className={`border-r rtl:border-l rtl:border-r-0 border-zinc-800/80 bg-zinc-950/90 flex flex-col items-center py-2.5 shrink-0 overflow-y-auto select-none transition-all duration-300 ease-in-out ${
                isPeeked ? 'w-full sm:w-80 px-3 space-y-2' : 'w-20 sm:w-24 px-1 space-y-2'
              }`}
            >
              {/* Peek Toggle Header when expanded */}
              {isPeeked && (
                <div className="w-full flex items-center justify-between pb-2 border-b border-zinc-800/60 mb-1">
                  <span className="text-xs font-bold text-zinc-300">
                    {isArabic ? 'قائمة الميزات السريعة' : 'Feature Quick Directory'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPeeked(false)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[11px] font-semibold transition active:scale-95 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'إظهار الشرح' : 'Show Details'}</span>
                  </button>
                </div>
              )}

              {/* Back to Full Grid Button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setIsPeeked(false);
                }}
                className={`rounded-xl flex items-center justify-center gap-1 hover:bg-zinc-850 text-zinc-400 hover:text-white transition cursor-pointer ${
                  isPeeked ? 'w-full py-2 px-3 flex-row justify-start gap-2.5' : 'w-16 py-2 px-1 flex-col'
                }`}
                title="Back to All Cards"
              >
                <LayoutGrid className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className={`font-bold leading-tight ${isPeeked ? 'text-xs' : 'text-[9px] text-center truncate w-full'}`}>
                  {isArabic ? 'عرض كافة البطاقات' : 'Back to Grid'}
                </span>
              </button>

              {/* Release Notes Strip Item */}
              <button
                type="button"
                onClick={() => {
                  setSelectedId('changelog');
                  setIsPeeked(false);
                }}
                className={`rounded-xl flex items-center justify-center gap-1 transition cursor-pointer ${
                  isPeeked ? 'w-full py-2 px-3 flex-row justify-start gap-2.5' : 'w-16 py-2 px-1 flex-col'
                } ${
                  selectedId === 'changelog'
                    ? 'bg-blue-600/25 border border-blue-500/50 text-white shadow-md'
                    : 'text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200 border border-transparent'
                }`}
                title="Release Notes"
              >
                <History className={`w-4 h-4 shrink-0 ${selectedId === 'changelog' ? 'text-blue-400' : 'text-zinc-400'}`} />
                <span className={`font-bold leading-tight ${isPeeked ? 'text-xs' : 'text-[9px] text-center truncate w-full'}`}>
                  {isArabic ? 'سجل التحديثات' : 'Changelog'}
                </span>
              </button>

              <div className="w-full h-px bg-zinc-800 my-1" />

              {/* Feature Items Strip */}
              {APP_CORE_FEATURES.map((feat) => {
                const isSelected = selectedId === feat.id;
                const titleText = isArabic ? feat.title.ar : feat.title.en;
                const shortTitle = titleText.split(' ').slice(0, 2).join(' ');

                return (
                  <button
                    key={feat.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(feat.id);
                      setIsPeeked(false);
                    }}
                    className={`rounded-xl flex items-center transition cursor-pointer ${
                      isPeeked
                        ? 'w-full p-2.5 flex-row gap-3 text-left rtl:text-right'
                        : 'w-16 py-2 px-1 flex-col justify-center gap-1'
                    } ${
                      isSelected
                        ? 'bg-blue-600/25 border border-blue-500/50 text-white shadow-md scale-105'
                        : 'text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200 border border-transparent'
                    }`}
                    title={titleText}
                  >
                    <span className="text-xl shrink-0">{feat.icon}</span>
                    <div className="min-w-0 flex-1">
                      <span className={`font-semibold leading-tight block truncate ${isPeeked ? 'text-xs text-white' : 'text-[9px] text-center w-full px-0.5'}`}>
                        {isPeeked ? titleText : shortTitle}
                      </span>
                      {isPeeked && (
                        <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                          {isArabic ? feat.description.ar : feat.description.en}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Sliding Detailed Explanation Window */}
            <div
              className={`flex-1 flex flex-col bg-zinc-950 overflow-hidden transition-all duration-300 ease-in-out ${
                isPeeked ? 'hidden sm:hidden' : 'flex'
              }`}
            >
              {/* Detail Pane Header with Peek Toggle and Close to Grid */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/50 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base font-bold text-white truncate">
                    {selectedId === 'changelog'
                      ? (isArabic ? 'سجل التحديثات الكامل' : 'Release Notes & Updates')
                      : selectedFeature
                      ? (isArabic ? selectedFeature.title.ar : selectedFeature.title.en)
                      : ''}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Peek / Slide-out Button without text reflow */}
                  <button
                    type="button"
                    onClick={() => setIsPeeked(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer"
                    title="Peek / Slide out"
                  >
                    <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="hidden sm:inline">{isArabic ? 'إخفاء مؤقت' : 'Peek Slide'}</span>
                  </button>

                  {/* Close Details and return to Full Cards Grid */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      setIsPeeked(false);
                    }}
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                    title="Close Details Pane"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Detailed Content Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {selectedId === 'changelog' ? (
                  /* RELEASE NOTES VIEW */
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                        <History className="w-4 h-4 shrink-0" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-white whitespace-normal break-words leading-snug">
                          {isArabic ? 'سجل التحديثات (الأحدث أولاً)' : 'Release Notes (Newest Top)'}
                        </h4>
                        <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">
                          {isArabic
                            ? 'تفاصيل كافة التحديثات والإصدارات الصادرة للتطبيق'
                            : 'Full changelog history of all released versions'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      {APP_RELEASE_NOTES.map((note, index) => {
                        const isLatest = index === 0;
                        return (
                          <div
                            key={note.version}
                            className={`p-4 rounded-2xl border transition ${
                              isLatest
                                ? 'bg-blue-950/20 border-blue-600/50 shadow-lg shadow-blue-950/40'
                                : 'bg-zinc-900/60 border-zinc-800/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-full bg-blue-600/30 border border-blue-500/50 text-blue-300 shrink-0 whitespace-nowrap">
                                  v{note.version}
                                </span>
                                {isLatest && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0 whitespace-nowrap">
                                    {isArabic ? 'أحدث إصدار' : 'Latest'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-zinc-500 font-mono shrink-0">
                                {note.releaseDate}
                              </span>
                            </div>

                            <h5 className="text-sm font-bold text-white mb-2">
                              {isArabic ? note.title.ar : note.title.en}
                            </h5>

                            <ul className="space-y-1.5">
                              {(isArabic ? note.highlights.ar : note.highlights.en).map(
                                (h, hIdx) => (
                                  <li
                                    key={hIdx}
                                    className="flex items-start gap-2 text-xs text-zinc-300 leading-relaxed"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                                    <span>{h}</span>
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : selectedFeature ? (
                  /* FEATURE DETAIL VIEW */
                  <div className="space-y-5 animate-in fade-in">
                    {/* Top Feature Banner */}
                    <div className="p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-3xl shadow-inner shrink-0">
                          {selectedFeature.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-black text-white">
                              {isArabic ? selectedFeature.title.ar : selectedFeature.title.en}
                            </h4>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {selectedFeature.category}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                            {isArabic ? selectedFeature.description.ar : selectedFeature.description.en}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Step-by-Step How To Use Guide */}
                    <div className="space-y-3">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-emerald-400" />
                        <span>{isArabic ? 'كيفية استخدام هذه الميزة خطوة بخطوة' : 'Step-by-Step How to Use'}</span>
                      </h5>

                      <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-2.5">
                        {selectedFeature.howToUse ? (
                          (isArabic ? selectedFeature.howToUse.ar : selectedFeature.howToUse.en).map(
                            (step, sIdx) => (
                              <div key={sIdx} className="flex items-start gap-3 text-xs text-zinc-200">
                                <span className="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-500/50 text-blue-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                  {sIdx + 1}
                                </span>
                                <span className="leading-relaxed">{step}</span>
                              </div>
                            )
                          )
                        ) : (
                          <div className="text-xs text-zinc-400 leading-relaxed space-y-2">
                            <p>
                              {isArabic
                                ? 'يمكنك الوصول إلى هذه الميزة مباشرة من القائمة أو التبويب الخاص بها في الشريط السفلي.'
                                : 'Access this feature directly from the relevant bottom navigation tab or sidebar menu.'}
                            </p>
                            <p>
                              {isArabic
                                ? 'كافة التعديلات والإجراءات تحفظ فورياً وبشكل دائم في ذاكرة هاتفك بدون الحاجة للاتصال بالإنترنت.'
                                : 'All changes and operations save immediately and permanently to local storage without requiring internet.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Practical Tips */}
                    <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-500/30 flex items-start gap-3 text-xs text-blue-200">
                      <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        {isArabic
                          ? 'تلميح: يدعم التطبيق زر الرجوع بهواتف أندرويد وإيماءات السحب الأفقي للتبديل بين التبويبات بسهولة تامة.'
                          : 'Pro-Tip: Fully integrated with Android Hardware Back button & horizontal swipe gestures for ultra-fluid navigation.'}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3.5 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-zinc-500 font-mono">
            {isArabic ? 'تطبيق إدارة الأموال الشخصي PWA' : 'Personal Finance Offline PWA'}
          </span>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs transition cursor-pointer"
          >
            {isArabic ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
