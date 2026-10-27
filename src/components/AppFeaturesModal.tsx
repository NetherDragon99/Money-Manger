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
  Eye,
  EyeOff,
  LayoutGrid,
  Loader2,
  AlertTriangle,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { CURRENT_APP_VERSION } from '../utils/versionChecker';
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
      return title.includes(q) || subtitle.includes(q) || desc.includes(q);
    });
  }, [featuresData?.features, searchQuery, isArabic]);

  // Selected feature item
  const selectedFeature = useMemo(() => {
    if (!selectedId || selectedId === 'changelog') return null;
    return featuresData?.features.find((f) => f.id === selectedId) || null;
  }, [featuresData?.features, selectedId]);

  // Transition Helpers
  const openFeatureInSplit = (id: string) => {
    setSelectedId(id);
    setFeatureGuideLayout('split');
  };

  const expandToFullscreen = () => {
    setFeatureGuideLayout('full');
  };

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      navigateBack();
    }, 180);
  };

  // 2. TOUCH GESTURE HANDLING: Horizontal Swipe Transitions with RTL Support
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

    // Guard: ignore vertical scrolls
    if (Math.abs(deltaY) > Math.abs(deltaX) || Math.abs(deltaX) < 45) {
      return;
    }

    if (isArabic) {
      // RTL: Inward swipe is Right (deltaX > 45), Return swipe is Left (deltaX < -45)
      if (featureGuideLayout === 'split' && deltaX > 45) {
        // Swipe inward -> Expand to Fullscreen State 3
        expandToFullscreen();
      } else if (featureGuideLayout === 'full' && deltaX < -45) {
        // Swipe back once from State 3 -> Return to State 2
        navigateBack();
      } else if (featureGuideLayout === 'split' && deltaX < -45) {
        // Swipe in return direction again from State 2 -> Collapse to State 1
        navigateBack();
      }
    } else {
      // LTR: Inward swipe is Left (deltaX < -45), Return swipe is Right (deltaX > 45)
      if (featureGuideLayout === 'split' && deltaX < -45) {
        // Swipe inward -> Expand to Fullscreen State 3
        expandToFullscreen();
      } else if (featureGuideLayout === 'full' && deltaX > 45) {
        // Swipe back once from State 3 -> Return to State 2
        navigateBack();
      } else if (featureGuideLayout === 'split' && deltaX > 45) {
        // Swipe in return direction again from State 2 -> Collapse to State 1
        navigateBack();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleAnimatedClose}
      onTouchMove={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-black/70 backdrop-blur-md overscroll-contain transition-all duration-200 ${
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
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-zinc-800/80 bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                {isArabic ? 'دليل الاستخدام ومميزات التطبيق' : 'User Guide & Feature Directory'}
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                {isArabic ? `الإصدار الحالي: Beta v${CURRENT_APP_VERSION}` : `Current Release: Beta v${CURRENT_APP_VERSION}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* If in State 2 or State 3, show return to grid button */}
            {selectedId !== null && (
              <button
                type="button"
                onClick={navigateBack}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition cursor-pointer active:scale-95"
                title={isArabic ? 'العودة لشبكة البطاقات' : 'Back to Grid'}
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

          {/* LOADED CONTENT: 3-STATE LAYOUT FLOW */}
          {!isLoading && !loadError && (
            <>
              {/* =========================================================================
                  STATE 1: FULL-SCREEN CARDS GRID (When no feature is currently selected)
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
                            ? 'ابحث في كافة المميزات والأدلة...'
                            : 'Search all features, guides, and tools...'
                        }
                        className="w-full pl-9 pr-9 rtl:pl-9 rtl:pr-9 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>

                  {/* Scrollable Grid Area */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {/* Release Notes Highlight Card */}
                    <div
                      onClick={() => openFeatureInSplit('changelog')}
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
                                Beta v{CURRENT_APP_VERSION}
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

                    {/* Feature Cards Grid (State 1: Displays Icon + Title + 2-5 Word Subtitle) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                      {filteredFeatures.map((feat) => (
                        <div
                          key={feat.id}
                          onClick={() => openFeatureInSplit(feat.id)}
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

                            {/* Ultra-Concise 2-to-5-Word Subtitle (GRID ONLY) */}
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
                    STATE 2 & STATE 3: 50/50 SPLIT VIEW & FULL-SCREEN DETAIL VIEW
                    ========================================================================= */
                <div
                  className="flex-1 flex min-h-0 overflow-hidden relative"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  {/* SIDE 1: COMPACT TITLES LIST
                      - Visible in State 2 (50/50 split).
                      - Hidden when in State 3 (full-screen detail view).
                      - Subtitle is STRICTLY HIDDEN here as requested! */}
                  <div
                    className={`border-r rtl:border-l rtl:border-r-0 border-zinc-800/80 bg-zinc-950 flex flex-col shrink-0 overflow-y-auto select-none transition-all duration-300 ease-in-out ${
                      featureGuideLayout === 'full'
                        ? 'hidden'
                        : 'w-full sm:w-1/2 md:w-1/2 p-3 space-y-2'
                    }`}
                  >
                    {/* Header in Split Mode */}
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 px-1">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        {isArabic ? 'قائمة المميزات' : 'Feature Directory'}
                      </span>
                      <button
                        type="button"
                        onClick={navigateBack}
                        className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'الشبكة' : 'All Cards'}</span>
                      </button>
                    </div>

                    {/* Release Notes Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedId('changelog')}
                      className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition cursor-pointer text-left rtl:text-right ${
                        selectedId === 'changelog'
                          ? 'bg-blue-600/20 border border-blue-500/50 text-white shadow-md'
                          : 'bg-zinc-900/60 border border-zinc-800/60 text-zinc-400 hover:bg-zinc-850 hover:text-white'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400 shrink-0">
                        <History className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold truncate flex-1">
                        {isArabic ? 'سجل التحديثات' : 'Release Notes'}
                      </span>
                    </button>

                    {/* Features Compact List: Icon + Distinctive Title ONLY (Subtitle is HIDDEN) */}
                    {featuresData?.features.map((feat) => {
                      const isSelected = selectedId === feat.id;
                      return (
                        <button
                          key={feat.id}
                          type="button"
                          onClick={() => setSelectedId(feat.id)}
                          className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition cursor-pointer text-left rtl:text-right ${
                            isSelected
                              ? 'bg-blue-600/25 border border-blue-500/60 text-white shadow-lg'
                              : 'bg-zinc-900/40 border border-zinc-800/40 text-zinc-400 hover:bg-zinc-850 hover:text-white'
                          }`}
                        >
                          <span className="text-xl shrink-0">{feat.icon}</span>
                          <span className="text-xs font-bold truncate flex-1 leading-snug">
                            {isArabic ? feat.title.ar : feat.title.en}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* SIDE 2: DETAILED GUIDE PANEL
                      - Takes 50% in State 2 (Split View).
                      - Takes 100% (full-width) in State 3 (Full-Screen Detail View). */}
                  <div
                    className={`flex-1 flex flex-col bg-zinc-950 overflow-hidden transition-all duration-300 ease-in-out ${
                      featureGuideLayout === 'full' ? 'w-full' : 'w-full sm:w-1/2 md:w-1/2'
                    }`}
                  >
                    {/* Detail Panel Header */}
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
                        {/* Expand/Collapse Toggle Button */}
                        {featureGuideLayout === 'split' ? (
                          <button
                            type="button"
                            onClick={expandToFullscreen}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer active:scale-95"
                            title={isArabic ? 'توسيع بملء الشاشة' : 'Expand Fullscreen'}
                          >
                            <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                            <span className="hidden sm:inline">{isArabic ? 'توسيع' : 'Expand'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={navigateBack}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer active:scale-95"
                            title={isArabic ? 'تصغير إلى العرض المقسم' : 'Collapse to Split'}
                          >
                            <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                            <span className="hidden sm:inline">{isArabic ? 'تصغير' : 'Collapse'}</span>
                          </button>
                        )}

                        {/* Close / Back Button to return to Grid */}
                        <button
                          type="button"
                          onClick={navigateBack}
                          className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                          title={isArabic ? 'العودة للشبكة' : 'Return to Grid'}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Detail Panel Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                      {selectedId === 'changelog' ? (
                        /* RELEASE NOTES CONTENT */
                        <div className="space-y-4 animate-in fade-in">
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
                        <div className="space-y-5 animate-in fade-in">
                          {/* Banner */}
                          <div className="p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-3">
                            <div className="flex items-center gap-3.5">
                              <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-3xl shadow-inner shrink-0">
                                {selectedFeature.icon}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-base sm:text-lg font-black text-white">
                                    {isArabic ? selectedFeature.title.ar : selectedFeature.title.en}
                                  </h4>
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    {selectedFeature.category}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                                  {isArabic
                                    ? selectedFeature.description.ar
                                    : selectedFeature.description.en}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Step-by-Step Instructions */}
                          <div className="space-y-3">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                              <HelpCircle className="w-4 h-4 text-emerald-400" />
                              <span>
                                {isArabic
                                  ? 'كيفية استخدام هذه الميزة خطوة بخطوة'
                                  : 'Where to Find It & How to Use It'}
                              </span>
                            </h5>

                            <div className="p-4 rounded-3xl bg-zinc-900/50 border border-zinc-800 space-y-3">
                              {selectedFeature.howToUse.en.map((_, sIdx) => {
                                const stepText = isArabic
                                  ? selectedFeature.howToUse.ar[sIdx]
                                  : selectedFeature.howToUse.en[sIdx];
                                return (
                                  <div
                                    key={sIdx}
                                    className="flex items-start gap-3 text-xs text-zinc-200"
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

                          {/* GENUINE OPTIONAL PRO TIP: Rendered ONLY if proTip is present! */}
                          {selectedFeature.proTip && (
                            <div className="p-4 rounded-3xl bg-blue-950/20 border border-blue-500/30 flex items-start gap-3 text-xs text-blue-200">
                              <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <span className="font-bold text-blue-300 block">
                                  {isArabic ? '💡 تلميح مفيد:' : '💡 Pro Tip:'}
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
