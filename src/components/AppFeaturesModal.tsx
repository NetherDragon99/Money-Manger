import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  Sparkles,
  CheckCircle2,
  History,
  Layers,
  Search,
  BookOpen,
  ChevronRight,
  HelpCircle,
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

  const [selectedId, setSelectedId] = useState<string>('changelog');
  const [searchQuery, setSearchQuery] = useState('');

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
    if (selectedId === 'changelog') return null;
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
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-4xl h-[92vh] sm:h-[86vh] flex flex-col rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl text-white overflow-hidden transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Header */}
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
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master - Detail Split Layout */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
          {/* Left Master Panel: Feature Directory & Release Notes List */}
          <div className="w-full sm:w-72 lg:w-80 border-b sm:border-b-0 sm:border-r border-zinc-800/80 flex flex-col bg-zinc-950/60 shrink-0 max-h-[35vh] sm:max-h-full">
            {/* Search Input */}
            <div className="p-3 border-b border-zinc-800/60">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isArabic ? 'ابحث في المميزات...' : 'Search features...'}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* Release Notes Button */}
              <button
                type="button"
                onClick={() => setSelectedId('changelog')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer ${
                  selectedId === 'changelog'
                    ? 'bg-blue-600/20 text-white border border-blue-500/40 shadow-sm'
                    : 'text-zinc-300 hover:bg-zinc-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                    <History className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">
                      {isArabic ? 'سجل التحديثات' : 'Release Notes'}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      {isArabic ? 'الإصدارات والتحسينات' : 'Versions & updates'}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                  v{CURRENT_APP_VERSION}
                </span>
              </button>

              <div className="pt-2 pb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {isArabic ? 'مميزات التطبيق' : 'Application Features'} ({filteredFeatures.length})
              </div>

              {filteredFeatures.map((feat) => {
                const isSelected = selectedId === feat.id;
                return (
                  <button
                    key={feat.id}
                    type="button"
                    onClick={() => setSelectedId(feat.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 text-white border border-blue-500/40 shadow-sm'
                        : 'text-zinc-300 hover:bg-zinc-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg shrink-0">{feat.icon}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {isArabic ? feat.title.ar : feat.title.en}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate">
                          {isArabic ? feat.description.ar : feat.description.en}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 text-zinc-500 shrink-0 ${isArabic ? 'rotate-180' : ''}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Detail Panel: Dynamic Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-950">
            {selectedId === 'changelog' ? (
              /* RELEASE NOTES VIEW */
              <div className="space-y-4 animate-in fade-in">
                {/* Fixed Badge & Header */}
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

        {/* Footer */}
        <div className="p-3.5 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-zinc-500 font-mono">
            {isArabic ? 'تطبيق إدارة الأموال الشخصي PWA' : 'Personal Finance Offline PWA'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs transition cursor-pointer"
          >
            {isArabic ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
