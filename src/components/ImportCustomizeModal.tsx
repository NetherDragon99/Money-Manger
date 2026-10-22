import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Upload,
  X,
  FileText,
  Check,
  ShieldCheck,
  AlertTriangle,
  GitMerge,
  RefreshCw,
  Wallet,
  Tag,
  Receipt,
  Target,
  Users,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  parseBackupFile,
  ParsedBackupPreview,
  CustomImportConfig,
} from '../utils/storage';

interface ImportCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportCustomizeModal: React.FC<ImportCustomizeModalProps> = ({ isOpen, onClose }) => {
  const { settings, importCustomData, showToast, t } = useApp();
  const isArabic = settings.language === 'ar';

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedBackupPreview | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [config, setConfig] = useState<CustomImportConfig>({
    importAccounts: true,
    importCategories: true,
    importTransactions: true,
    importBudgets: true,
    importSharedSpaces: true,
    mode: 'merge',
  });

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setIsImporting(false);
    } else {
      setSelectedFile(null);
      setPreview(null);
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setErrorMsg(
        isArabic
          ? 'يرجى اختيار ملف بصيغة JSON صالح (.json)'
          : 'Please select a valid JSON backup file (.json)'
      );
      return;
    }

    setErrorMsg(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const res = parseBackupFile(text);
        if (!res.valid) {
          setErrorMsg(
            isArabic
              ? `الملف غير صالح أو تالف: ${res.error || 'تنسيق غير مدعوم'}`
              : `Invalid or corrupt file: ${res.error || 'Unsupported format'}`
          );
          setPreview(null);
          return;
        }

        setPreview(res);
        // Automatically check sections that have at least 1 item detected
        setConfig((prev) => ({
          ...prev,
          importAccounts: res.accountsCount > 0,
          importCategories: res.categoriesCount > 0,
          importTransactions: res.transactionsCount > 0,
          importBudgets: res.budgetsCount > 0,
          importSharedSpaces: res.sharedSpacesCount > 0,
        }));
      } catch (err: any) {
        setErrorMsg(
          isArabic
            ? 'فشلت قراءة الملف، يرجى التأكد من سلامة ملف JSON.'
            : 'Failed to read file. Please ensure it is valid JSON.'
        );
        setPreview(null);
      }
    };
    reader.onerror = () => {
      setErrorMsg(
        isArabic ? 'حدث خطأ أثناء قراءة الملف.' : 'Error occurred reading file.'
      );
      setPreview(null);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreview(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isAllSelected =
    config.importAccounts &&
    config.importCategories &&
    config.importTransactions &&
    config.importBudgets &&
    config.importSharedSpaces;

  const handleToggleAll = () => {
    const nextVal = !isAllSelected;
    setConfig((prev) => ({
      ...prev,
      importAccounts: nextVal,
      importCategories: nextVal,
      importTransactions: nextVal,
      importBudgets: nextVal,
      importSharedSpaces: nextVal,
    }));
  };

  const hasAtLeastOne =
    config.importAccounts ||
    config.importCategories ||
    config.importTransactions ||
    config.importBudgets ||
    config.importSharedSpaces;

  const handleExecuteImport = async () => {
    if (!preview || !preview.rawPayload) return;
    if (!hasAtLeastOne) {
      showToast(
        isArabic ? 'يرجى تحديد قسم واحد على الأقل للاستيراد' : 'Please select at least one section to import',
        'error'
      );
      return;
    }

    setIsImporting(true);
    try {
      const success = await importCustomData(preview.rawPayload, config);
      if (success) {
        handleAnimatedClose();
      }
    } catch (err) {
      console.error('[ImportCustomizeModal] Error:', err);
    } finally {
      setIsImporting(false);
    }
  };

  const sections: Array<{
    key: keyof Omit<CustomImportConfig, 'mode'>;
    icon: React.ReactNode;
    titleEn: string;
    titleAr: string;
    descEn: string;
    descAr: string;
    count: number;
  }> = preview
    ? [
        {
          key: 'importAccounts',
          icon: <Wallet className="w-4 h-4 text-blue-400" />,
          titleEn: 'Accounts & Balances',
          titleAr: 'الحسابات المالية والأرصدة',
          descEn: 'Bank, cash, wallets, and savings accounts',
          descAr: 'حسابات البنك والنقدية والمحافظ والمدخرات',
          count: preview.accountsCount,
        },
        {
          key: 'importCategories',
          icon: <Tag className="w-4 h-4 text-emerald-400" />,
          titleEn: 'Categories & Icons',
          titleAr: 'الفئات والأيقونات والترتيب',
          descEn: 'Expense and income categorization definitions',
          descAr: 'تصنيفات المصروفات والإيرادات وترتيبها المخصص',
          count: preview.categoriesCount,
        },
        {
          key: 'importBudgets',
          icon: <Target className="w-4 h-4 text-purple-400" />,
          titleEn: 'Budgets & Monthly Targets',
          titleAr: 'الميزانيات والحدود الشهرية',
          descEn: 'Monthly spending caps and budget targets',
          descAr: 'حدود المصروفات وسقوف الميزانية الشهرية المحددة',
          count: preview.budgetsCount,
        },
        {
          key: 'importTransactions',
          icon: <Receipt className="w-4 h-4 text-amber-400" />,
          titleEn: 'Transactions & Audit History',
          titleAr: 'المعاملات وسجل التدقيق التاريخي',
          descEn: 'Income, expense, and transfer records with ledger history',
          descAr: 'سجل العمليات المالية والتحويلات والأرصدة التاريخية',
          count: preview.transactionsCount,
        },
        {
          key: 'importSharedSpaces',
          icon: <Users className="w-4 h-4 text-indigo-400" />,
          titleEn: 'Shared Spaces & Collaboration',
          titleAr: 'المساحات المشتركة والمجموعات',
          descEn: 'Created and received collaborative shared accounts',
          descAr: 'مساحات الحسابات المشتركة الصادرة والواردة',
          count: preview.sharedSpacesCount,
        },
      ]
    : [];

  return (
    <div
      onClick={handleAnimatedClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-md transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[92dvh] my-auto flex flex-col rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl text-white overflow-hidden transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isArabic ? 'استيراد البيانات المخصص' : 'Custom Data Import'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {isArabic
                  ? 'معاينة ودمج أو استبدال الأقسام المحددة'
                  : 'Preview, selectively merge or replace sections'}
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* STEP 1: File Selection Area */}
          {!preview ? (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-3 ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-950/20 scale-[1.01]'
                    : 'border-zinc-800 hover:border-emerald-500/50 bg-zinc-900/50 hover:bg-zinc-900/80'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isArabic
                      ? 'اختر ملف النسخة الاحتياطية (JSON)'
                      : 'Choose Backup File (JSON)'}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                    {isArabic
                      ? 'اسحب الملف هنا أو انقر لتصفح ملفات جهازك (.json)'
                      : 'Drag & drop here or click to browse files (.json)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs transition shadow-md shadow-emerald-950 cursor-pointer flex items-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'تصفح الملفات' : 'Browse Files'}</span>
                </button>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-900/60 flex items-center gap-2.5 text-red-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
                <span className="font-semibold text-zinc-300 block">
                  {isArabic ? 'الملفات المدعومة:' : 'Supported File Formats:'}
                </span>
                <p>
                  {isArabic
                    ? '• النسخ الاحتياطية الشاملة والتصدير المخصص من التطبيق.'
                    : '• Full backups and granular customized exports from this app.'}
                </p>
                <p>
                  {isArabic
                    ? '• نسخ الحسابات الفردية أو النسخ السحابية التلقائية.'
                    : '• Single account backup files or automated cloud snapshots.'}
                </p>
              </div>
            </div>
          ) : (
            /* STEP 2: File Preview, Section Checkboxes & Mode Selection */
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">
                      {selectedFile?.name || 'backup.json'}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                      <span>
                        {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''}
                      </span>
                      {preview.exportDate && (
                        <span>
                          • {new Date(preview.exportDate).toLocaleDateString()}
                        </span>
                      )}
                      {preview.version && (
                        <span className="font-mono text-zinc-500">
                          v{preview.version}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="p-1.5 rounded-xl bg-zinc-800 hover:bg-red-950/50 hover:text-red-400 text-zinc-400 transition cursor-pointer shrink-0"
                  title={isArabic ? 'تغيير الملف' : 'Change File'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Detected Counts Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 shrink-0">
                    <Wallet className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-zinc-400 block truncate">
                      {isArabic ? 'الحسابات' : 'Accounts'}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {preview.accountsCount}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Tag className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-zinc-400 block truncate">
                      {isArabic ? 'الفئات' : 'Categories'}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {preview.categoriesCount}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-600/20 flex items-center justify-center text-purple-400 shrink-0">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-zinc-400 block truncate">
                      {isArabic ? 'الميزانيات' : 'Budgets'}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {preview.budgetsCount}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-600/20 flex items-center justify-center text-amber-400 shrink-0">
                    <Receipt className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-zinc-400 block truncate">
                      {isArabic ? 'المعاملات' : 'Transactions'}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {preview.transactionsCount}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-2 col-span-2 sm:col-span-1">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-zinc-400 block truncate">
                      {isArabic ? 'المساحات' : 'Spaces'}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {preview.sharedSpacesCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Import Mode Selection */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-zinc-300 block">
                  {isArabic ? 'طريقة الاستيراد والتطبيق:' : 'Import Mode:'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Option A: Merge */}
                  <div
                    onClick={() => setConfig((prev) => ({ ...prev, mode: 'merge' }))}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                      config.mode === 'merge'
                        ? 'bg-blue-950/30 border-blue-500/50 shadow-md ring-1 ring-blue-500/30'
                        : 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GitMerge className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-white">
                          {isArabic ? 'دمج مع البيانات الحالية' : 'Merge with Current'}
                        </span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                        {isArabic ? 'موصى به' : 'Recommended'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      {isArabic
                        ? 'عدم تكرار السجلات وتحديث العناصر المتطابقة وإضافة المعاملات الجديدة بأمان تام.'
                        : 'Deduplicates by ID. Preserves existing records and appends new transactions safely.'}
                    </p>
                  </div>

                  {/* Option B: Replace */}
                  <div
                    onClick={() => setConfig((prev) => ({ ...prev, mode: 'replace' }))}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                      config.mode === 'replace'
                        ? 'bg-red-950/30 border-red-500/50 shadow-md ring-1 ring-red-500/30'
                        : 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-white">
                          {isArabic ? 'استبدال البيانات الحالية' : 'Replace Current Data'}
                        </span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-semibold">
                        {isArabic ? 'استبدال' : 'Overwrite'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      {isArabic
                        ? 'استبدال الأقسام المحددة بالكامل بمحتويات هذا الملف وحذف بياناتها الحالية.'
                        : 'Replaces existing data in selected sections entirely with the contents of this file.'}
                    </p>
                  </div>
                </div>

                {config.mode === 'replace' && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-900/60 flex items-center gap-2 text-amber-300 text-[11px]">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>
                      {isArabic
                        ? 'تنبيه: سيتم استبدال محتويات الأقسام المؤشرة بالكامل ومسح العناصر الحالية فيها!'
                        : 'Warning: Selected sections will be overwritten. Current items in those sections will be replaced!'}
                    </span>
                  </div>
                )}
              </div>

              {/* Section Checkboxes */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300">
                    {isArabic ? 'اختر الأقسام المطلوب استيرادها:' : 'Select Sections to Import:'}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleAll}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                  >
                    {isAllSelected
                      ? isArabic
                        ? 'إلغاء تحديد الكل'
                        : 'Deselect All'
                      : isArabic
                      ? 'تحديد الكل'
                      : 'Select All'}
                  </button>
                </div>

                <div className="space-y-2">
                  {sections.map((sec) => {
                    const isChecked = config[sec.key];
                    const count = sec.count;
                    return (
                      <div
                        key={sec.key}
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            [sec.key]: !prev[sec.key],
                          }))
                        }
                        className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                          isChecked
                            ? 'bg-zinc-900/90 border-emerald-500/40 text-white'
                            : 'bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:bg-zinc-900/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                            {sec.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate">
                                {isArabic ? sec.titleAr : sec.titleEn}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold border shrink-0 ${
                                  count > 0
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                                }`}
                              >
                                {count} {isArabic ? 'عنصر' : 'items'}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                              {isArabic ? sec.descAr : sec.descEn}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition ${
                            isChecked
                              ? 'bg-emerald-600 text-white'
                              : 'border border-zinc-600'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleAnimatedClose}
            disabled={isImporting}
            className="flex-1 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
          >
            {t('cancel')}
          </button>

          {preview && (
            <button
              type="button"
              disabled={!hasAtLeastOne || isImporting}
              onClick={handleExecuteImport}
              className={`flex-1 py-3 rounded-xl font-bold text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed ${
                config.mode === 'replace'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
              }`}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {isArabic ? 'جاري الاستيراد والمزامنة...' : 'Importing & Syncing...'}
                  </span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>
                    {isArabic
                      ? config.mode === 'merge'
                        ? 'دمج البيانات المحددة'
                        : 'استبدال البيانات المحددة'
                      : config.mode === 'merge'
                      ? 'Merge Selected Data'
                      : 'Replace Selected Data'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
