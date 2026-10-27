import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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

  private handleReset = () => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#000000',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '440px',
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '24px',
            padding: '32px 24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              App Encountered an Issue / واجه التطبيق مشكلة
            </h1>
            <p style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '24px', lineHeight: '1.6' }}>
              The application encountered a problem during startup. You can reload or reset stored data to return to a fresh state.
              <br />
              واجه التطبيق مشكلة أثناء بدء التشغيل. يمكنك إعادة التحميل أو إعادة تعيين البيانات المخزنة للعودة إلى حالة جديدة.
            </p>
            {this.state.error && (
              <pre style={{
                fontSize: '11px',
                color: '#ef4444',
                backgroundColor: '#09090b',
                padding: '12px',
                borderRadius: '12px',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '20px'
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '9999px',
                  backgroundColor: '#27272a',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Reload / إعادة تحميل
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '9999px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Reset / إعادة تعيين
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
