import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getActiveLanguage, resetAppCacheSafely } from './utils/activeLanguage';

declare global {
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
      outcome: 'accepted' | 'dismissed';
      platform: string;
    }>;
    prompt(): Promise<void>;
  }
  interface Window {
    deferredPwaPrompt: BeforeInstallPromptEvent | null;
    deferredPWAInstallPrompt: BeforeInstallPromptEvent | null;
    __appMounted?: boolean;
    __clearBootWatchdog?: () => void;
  }
}

// Fallback listener: only assigns the globals if they are still empty (never overwriting an already captured event)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    if (!window.deferredPwaPrompt) {
      window.deferredPwaPrompt = e as BeforeInstallPromptEvent;
    }
    if (!window.deferredPWAInstallPrompt) {
      window.deferredPWAInstallPrompt = e as BeforeInstallPromptEvent;
    }
  });

  window.addEventListener('appinstalled', () => {
    window.deferredPwaPrompt = null;
    window.deferredPWAInstallPrompt = null;
  });
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Personal Finance App:', error, errorInfo);
  }

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
          style={{
            minHeight: '100vh',
            backgroundColor: '#090d16',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >
          <div style={{
            maxWidth: '440px',
            width: '100%',
            backgroundColor: '#111827',
            border: '1px solid #1f2937',
            borderRadius: '24px',
            padding: '32px 24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
              {title}
            </h1>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '24px', lineHeight: '1.6' }}>
              {description}
            </p>
            {this.state.error && (
              <pre
                dir="ltr"
                style={{
                  fontSize: '11px',
                  color: '#ef4444',
                  backgroundColor: '#030712',
                  border: '1px solid #1f2937',
                  padding: '12px',
                  borderRadius: '12px',
                  textAlign: 'left',
                  overflowX: 'auto',
                  marginBottom: '20px',
                  maxHeight: '120px'
                }}
              >
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: '14px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {reloadBtn}
              </button>
              <button
                type="button"
                onClick={() => void resetAppCacheSafely()}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: '14px',
                  backgroundColor: '#1f2937',
                  color: '#d1d5db',
                  border: '1px solid #374151',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {resetBtn}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  );

  // Mark app as successfully mounted, disarming boot error listeners and watchdog
  window.__appMounted = true;
  if (typeof window.__clearBootWatchdog === 'function') {
    window.__clearBootWatchdog();
  }

  // Seamlessly fade out and detach the raw HTML boot loader
  const bootLoader = document.getElementById('app-boot-loader');
  if (bootLoader) {
    bootLoader.style.transition = 'opacity 0.25s ease-out';
    bootLoader.style.opacity = '0';
    bootLoader.style.pointerEvents = 'none';
    setTimeout(() => {
      bootLoader.remove();
    }, 260);
  }
}
