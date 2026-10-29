import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { navigateBack } from '../context/NavigationContext';
import {
  X,
  Sparkles,
  CheckCircle2,
  History,
  Search,
  BookOpen,
  ChevronRight,
  HelpCircle,
  LayoutGrid,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Compass,
  MapPin,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { CURRENT_APP_VERSION, formatVersionLabel } from '../utils/versionChecker';
import { FeatureItem, ReleaseNote } from '../types';

interface AppFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppFeaturesModal: React.FC<AppFeaturesModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    selectedFeatureId: selectedId,
    setSelectedFeatureId: setSelectedId,
    featureGuideLayout,
    setFeatureGuideLayout,
  } = useApp();

  const isArabic = settings.language === 'ar';

  // 1. LAZY LOADING STATE: Dynamically load appFeatures.ts only when modal is open
  const [featuresData, setFeaturesData] = useState<{
    features: FeatureItem[];
    releaseNotes: ReleaseNote[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadFeaturesModule = () => {
    setIsLoading(true);
    setLoadError(null);
    import('../utils/appFeatures')
      .then((mod) => {
        setFeaturesData({
          features: mod.APP_CORE_FEATURES || [],
          releaseNotes: mod.APP_RELEASE_NOTES || [],
        });
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load appFeatures chunk:', err);
        setLoadError(err?.message || 'Failed to load chunk');
        setIsLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen && !featuresData && !isLoading) {
      loadFeaturesModule();
    }
  }, [isOpen, featuresData, isLoading]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  // Filter features based on search input
  const filteredFeatures = useMemo(() => {
    const list = featuresData?.features || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((feat) => {
      const title = (isArabic ? feat.title.ar : feat.title.en).toLowerCase();
      const subtitle = (isArabic ? feat.subtitle.ar : feat.subtitle.en).toLowerCase();
      const desc = (isArabic ? feat.description.ar : feat.description.en).toLowerCase();
      const where = (isArabic ? (feat.whereToFind?.ar || '') : (feat.whereToFind?.en || '')).toLowerCase();
      return title.includes(q) || subtitle.includes(q) || desc.includes(q) || where.includes(q);
    });
  }, [featuresData?.features, searchQuery, isArabic]);

  // Selected feature item
  const selectedFeature = useMemo(() => {
    if (!selectedId || selectedId === 'changelog') return null;
    return featuresData?.features.find((f) => f.id === selectedId) || null;
  }, [featuresData?.features, selectedId]);

  // Transition Helpers: 2-page direct flow (Grid <-> Preview)
  const openFeatureInPreview = (id: string) => {
    setSelectedId(id);
    setFeatureGuideLayout('preview');
  };

  const returnToGrid = () => {
    setSelectedId(null);
    setFeatureGuideLayout('grid');
  };

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      navigateBack();
    }, 180);
  };

  // 2. TOUCH GESTURE HANDLING: Direct Swipe from Preview back to the First Page (Grid)
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Guard: ignore vertical scrolls or tiny taps
    if (Math.abs(deltaY) > Math.abs(deltaX) || Math.abs(deltaX) < 40) {
      return;
    }

    // Direct swipe transition: Return from preview mode back to the first page (Grid)
    returnToGrid();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleAnimatedClose}
      onTouchMove={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-black/75 backdrop-blur-md overscroll-contain transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-5xl h-[92dvh] sm:h-[88dvh] my-auto flex flex-col rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl text-white overflow-hidden relative transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-800/80 bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                {isArabic ? 'دليل الاستخدام ومميزات التطبيق' : 'User Guide & Feature Directory'}
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                {isArabic
                  ? `الإصدار الحالي: ${formatVersionLabel(CURRENT_APP_VERSION)}`
                  : `Current Release: ${formatVersionLabel(CURRENT_APP_VERSION)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* If in Preview, show Return to Grid button */}
            {selectedId !== null && (
              <button
                type="button"
                onClick={returnToGrid}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition cursor-pointer active:scale-95"
                title={isArabic ? 'العودة للشبكة الرئيسية' : 'Return to Grid'}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">{isArabic ? 'عرض الشبكة' : 'Grid View'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAnimatedClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {/* SUSPENSE LOADING STATE */}
          {isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-spin">
                <Loader2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-zinc-300">
                {isArabic ? 'جاري تحميل دليل الاستخدام...' : 'Loading guide & features...'}
              </p>
            </div>
          )}

          {/* CHUNK LOAD ERROR WITH RETRY BUTTON */}
          {!isLoading && loadError && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="text-base font-bold text-white">
                  {isArabic ? 'تعذر تحميل دليل المميزات' : 'Failed to Load Features Guide'}
                </h4>
                <p className="text-xs text-zinc-400">
                  {isArabic
                    ? 'يرجى التحقق من الاتصال بالإنترنت وإعادة المحاولة.'
                    : 'Please check your connection and tap retry to reload the guide module.'}
                </p>
              </div>
              <button
                type="button"
                onClick={loadFeaturesModule}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isArabic ? 'إعادة المحاولة' : 'Retry'}</span>
              </button>
            </div>
          )}

          {/* LOADED CONTENT: 2-STATE DIRECT ARCHITECTURE (PAGE 1: GRID <-> PAGE 2: PREVIEW WITH THIN SIDEBAR) */}
          {!isLoading && !loadError && (
            <>
              {/* =========================================================================
                  PAGE 1: FIRST PAGE (FULL-SCREEN CARDS GRID)
                  - Displays Icon, Title, and Short Description on a good size
                  ========================================================================= */}
              {selectedId === null ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* Search Bar */}
                  <div className="p-3.5 sm:p-4 border-b border-zinc-800/60 bg-zinc-950/60 shrink-0">
                    <div className="relative max-w-md mx-auto">
                      <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={
                          isArabic
                            ? 'ابحث في كافة المميزات والأدلة ومسارات الوصول...'
                            : 'Search features, usage guides, and paths...'
                        }
                        className="w-full pl-9 pr-9 rtl:pl-9 rtl:pr-9 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>

                  {/* Scrollable Grid Area */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {/* Release Notes Highlight Card */}
                    <div
                      onClick={() => openFeatureInPreview('changelog')}
                      role="button"
                      tabIndex={0}
                      className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-blue-950/40 via-zinc-900 to-zinc-900/90 border border-blue-500/30 hover:border-blue-400 hover:scale-[1.008] transition cursor-pointer shadow-lg group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xl shadow-inner group-hover:scale-105 transition">
                            <History className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-bold text-white group-hover:text-blue-300 transition">
                                {isArabic ? 'سجل التحديثات والإصدارات' : 'Release Notes & Updates'}
                              </h4>
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                {formatVersionLabel(CURRENT_APP_VERSION)}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1">
                              {isArabic
                                ? 'استعرض كافة التحسينات والتحديثات الجديدة في إصدار التطبيق الأخير.'
                                : 'Explore recent enhancements, gesture navigation, and reliability updates.'}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className={`w-5 h-5 text-zinc-500 group-hover:text-white transition ${isArabic ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* Feature Cards Grid (Displays Icon + Distinctive Title + Subtitle + Short Description) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                      {filteredFeatures.map((feat) => (
                        <div
                          key={feat.id}
                          onClick={() => openFeatureInPreview(feat.id)}
                          role="button"
                          tabIndex={0}
                          className="p-4 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700 hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer flex flex-col justify-between group shadow-md"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <div className="w-10 h-10 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl group-hover:scale-110 transition shadow-inner">
                                {feat.icon}
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-950 text-zinc-400 border border-zinc-800">
                                {feat.category}
                              </span>
                            </div>

                            {/* Distinctive Title */}
                            <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition leading-snug">
                              {isArabic ? feat.title.ar : feat.title.en}
                            </h4>

                            {/* Ultra-Concise Subtitle */}
                            <p className="text-xs font-medium text-blue-400/90 mt-1">
                              {isArabic ? feat.subtitle.ar : feat.subtitle.en}
                            </p>

                            {/* Short Summary Description */}
                            <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
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
                /* =========================================================================
                    PAGE 2: PREVIEW VIEW WITH THIN QUICK-ACCESS SIDEBAR
                    - Thin Sidebar: Displays Icon + Title ONLY
                    - Detail Area: Displays Icon, Full Description, Where to Find, How to Use
                    - Tapping any item on the thin sidebar immediately updates the detail panel
                    - Swiping horizontally directly returns back to the First Page (Grid)
                    ========================================================================= */
                <div
                  className="flex-1 flex min-h-0 overflow-hidden relative"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  {/* THIN QUICK-ACCESS SIDEBAR:
                      - Displays ONLY the Icon and Title
                      - Compact, vertical column */}
                  <div className="w-[76px] sm:w-[84px] md:w-[92px] p-2 space-y-2 overflow-y-auto items-center border-r rtl:border-l rtl:border-r-0 border-zinc-800/80 bg-zinc-950 flex flex-col shrink-0 select-none transition-all duration-200">
                    {/* Release Notes Item in Thin Sidebar */}
                    <button
                      type="button"
                      onClick={() => setSelectedId('changelog')}
                      className={`w-full py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer active:scale-95 ${
                        selectedId === 'changelog'
                          ? 'bg-blue-600/25 border border-blue-500/60 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-zinc-900/40 border border-zinc-800/40 text-zinc-400 hover:bg-zinc-850 hover:text-white'
                      }`}
                      title={isArabic ? 'سجل التحديثات' : 'Release Notes'}
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 shrink-0">
                        <History className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-bold text-center leading-tight line-clamp-2 max-w-[68px] px-0.5">
                        {isArabic ? 'التحديثات' : 'Updates'}
                      </span>
                    </button>

                    {/* Features List in Thin Sidebar: Icon and Title ONLY */}
                    {featuresData?.features.map((feat) => {
                      const isSelected = selectedId === feat.id;
                      return (
                        <button
                          key={feat.id}
                          type="button"
                          onClick={() => setSelectedId(feat.id)}
                          className={`w-full py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer active:scale-95 group ${
                            isSelected
                              ? 'bg-blue-600/25 border border-blue-500/60 text-white shadow-lg shadow-blue-500/20'
                              : 'bg-zinc-900/40 border border-zinc-800/40 text-zinc-400 hover:bg-zinc-850 hover:text-white'
                          }`}
                          title={isArabic ? feat.title.ar : feat.title.en}
                        >
                          <span className="text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            {feat.icon}
                          </span>
                          <span className="text-[10px] font-bold text-center leading-tight line-clamp-2 max-w-[68px] px-0.5">
                            {isArabic ? feat.title.ar : feat.title.en}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* DETAIL PANEL:
                      - Full width of the remaining space
                      - Contains Icon, Full Description, Where to Find, How to Use, Pro Tip */}
                  <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden min-w-0 w-full transition-all duration-200">
                    {/* Detail Header */}
                    <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/50 shrink-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm sm:text-base font-bold text-white truncate">
                          {selectedId === 'changelog'
                            ? isArabic
                              ? 'سجل التحديثات والإصدارات'
                              : 'Release Notes & Updates'
                            : selectedFeature
                            ? isArabic
                              ? selectedFeature.title.ar
                              : selectedFeature.title.en
                            : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Back to Grid Button */}
                        <button
                          type="button"
                          onClick={returnToGrid}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition cursor-pointer active:scale-95"
                          title={isArabic ? 'العودة لشبكة البطاقات' : 'Return to Grid'}
                        >
                          <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
                          <span className="hidden sm:inline">
                            {isArabic ? 'عرض الشبكة' : 'Grid View'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Detail Panel Scrollable Body */}
                    <div
                      key={selectedId}
                      className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 animate-in fade-in duration-200"
                    >
                      {selectedId === 'changelog' ? (
                        /* RELEASE NOTES CONTENT */
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800">
                            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                              <History className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white">
                                {isArabic ? 'سجل التحديثات (الأحدث أولاً)' : 'Release Notes (Newest Top)'}
                              </h4>
                              <p className="text-xs text-zinc-400 mt-0.5">
                                {isArabic
                                  ? 'تفاصيل كافة التحديثات والإصدارات الصادرة للتطبيق'
                                  : 'Full changelog history of all released versions'}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3.5">
                            {featuresData?.releaseNotes.map((note, index) => {
                              const isLatest = index === 0;
                              return (
                                <div
                                  key={note.version}
                                  className={`p-4 rounded-3xl border transition ${
                                    isLatest
                                      ? 'bg-blue-950/20 border-blue-600/50 shadow-lg shadow-blue-950/40'
                                      : 'bg-zinc-900/50 border-zinc-800/80'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                                        v{note.version}
                                      </span>
                                      {isLatest && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                          {isArabic ? 'الإصدار الأخير' : 'Latest Release'}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-zinc-400 font-medium">
                                      {note.releaseDate}
                                    </span>
                                  </div>

                                  <h5 className="text-xs sm:text-sm font-bold text-white mb-2 leading-snug">
                                    {isArabic ? note.title.ar : note.title.en}
                                  </h5>

                                  <ul className="space-y-1.5 text-xs text-zinc-300">
                                    {(isArabic ? note.highlights.ar : note.highlights.en).map(
                                      (h, hIdx) => (
                                        <li
                                          key={hIdx}
                                          className="flex items-start gap-2 leading-relaxed"
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
                        /* FEATURE GUIDE DETAIL CONTENT */
                        <div className="space-y-5">
                          {/* Banner */}
                          <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-3 shadow-md">
                            <div className="flex items-start gap-3.5">
                              <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-3xl shadow-inner shrink-0">
                                {selectedFeature.icon}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-base sm:text-lg font-black text-white">
                                    {isArabic ? selectedFeature.title.ar : selectedFeature.title.en}
                                  </h4>
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    {selectedFeature.category}
                                  </span>
                                </div>
                                <p className="text-xs font-semibold text-blue-400 mt-0.5">
                                  {isArabic ? selectedFeature.subtitle.ar : selectedFeature.subtitle.en}
                                </p>
                                <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
                                  {isArabic
                                    ? selectedFeature.description.ar
                                    : selectedFeature.description.en}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* WHERE TO FIND IT SECTION */}
                          {selectedFeature.whereToFind && (
                            <div className="space-y-2">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                                <Compass className="w-4 h-4 text-amber-400" />
                                <span>
                                  {isArabic ? 'أين تجد هذه الميزة في التطبيق؟' : 'Where to Find It in the App'}
                                </span>
                              </h5>

                              <div className="p-3.5 sm:p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 shadow-inner">
                                <MapPin className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                                <p className="text-xs sm:text-sm text-amber-100 font-medium leading-relaxed">
                                  {isArabic ? selectedFeature.whereToFind.ar : selectedFeature.whereToFind.en}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* HOW TO USE STEP-BY-STEP INSTRUCTIONS */}
                          <div className="space-y-2">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                              <HelpCircle className="w-4 h-4 text-emerald-400" />
                              <span>
                                {isArabic
                                  ? 'كيفية استخدام هذه الميزة خطوة بخطوة'
                                  : 'Step-by-Step Practical Guide'}
                              </span>
                            </h5>

                            <div className="p-4 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                              {selectedFeature.howToUse.en.map((_, sIdx) => {
                                const stepText = isArabic
                                  ? selectedFeature.howToUse.ar[sIdx]
                                  : selectedFeature.howToUse.en[sIdx];
                                return (
                                  <div
                                    key={sIdx}
                                    className="flex items-start gap-3 text-xs sm:text-sm text-zinc-200"
                                  >
                                    <span className="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-500/50 text-blue-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                      {sIdx + 1}
                                    </span>
                                    <span className="leading-relaxed">{stepText}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* GENUINE OPTIONAL PRO TIP */}
                          {selectedFeature.proTip && (
                            <div className="p-4 rounded-3xl bg-blue-950/20 border border-blue-500/30 flex items-start gap-3 text-xs sm:text-sm text-blue-200">
                              <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <span className="font-bold text-blue-300 block">
                                  {isArabic ? '💡 تلميح ذكي:' : '💡 Pro Tip:'}
                                </span>
                                <p className="leading-relaxed">
                                  {isArabic
                                    ? selectedFeature.proTip.ar
                                    : selectedFeature.proTip.en}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-zinc-500 font-mono">
            {isArabic ? 'تطبيق إدارة الأموال الشخصي PWA' : 'Personal Finance Offline PWA'}
          </span>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs transition cursor-pointer active:scale-95"
          >
            {isArabic ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
