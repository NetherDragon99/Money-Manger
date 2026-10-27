import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { getActiveLanguage, resetAppCacheSafely } from '../utils/activeLanguage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isAr = getActiveLanguage() === 'ar';
      const title = isAr ? 'حدث خطأ غير متوقع' : 'Something Went Wrong';
      const description = isAr
        ? 'حدث خطأ غير متوقع أثناء تشغيل التطبيق. تم حفظ بياناتك بأمان.'
        : 'An unexpected error occurred while starting the app. Your data is safely saved.';
      const reloadBtn = isAr ? 'إعادة تحميل التطبيق' : 'Reload App';
      const resetBtn = isAr ? 'إعادة تعيين ذاكرة التخزين المؤقت' : 'Reset App Cache';

      return (
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950 text-white select-none"
        >
          <div className="w-full max-w-md p-6 rounded-3xl bg-zinc-900/95 border border-zinc-800 shadow-2xl text-center space-y-4 backdrop-blur-xl">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">{title}</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
            </div>

            {this.state.error && (
              <div
                dir="ltr"
                className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-left text-[11px] font-mono text-rose-300/90 overflow-x-auto max-h-32"
              >
                {this.state.error.toString()}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 shrink-0" />
                <span>{reloadBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => void resetAppCacheSafely()}
                className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>{resetBtn}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
