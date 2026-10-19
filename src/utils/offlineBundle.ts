/**
 * Generates and triggers the direct download of the standalone offline application file.
 * Allows users to have a tangible local copy of the app saved in their device downloads.
 */

import { AppData } from '../types';

export function downloadOfflineAppBundle(currentData: AppData, lang: 'en' | 'ar' = 'en'): void {
  const isArabic = lang === 'ar';
  const title = isArabic ? 'متتبع الميزانية والمصروفات الشخصية' : 'Personal Finance Tracker';

  const htmlContent = `<!doctype html>
<html lang="${lang}" dir="${isArabic ? 'rtl' : 'ltr'}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>${title}</title>
    <meta name="description" content="Offline-first standalone Personal Finance Tracker" />
    <meta name="theme-color" content="#000000" />
    <style>
      body {
        margin: 0;
        background-color: #000000;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
        box-sizing: border-box;
        text-align: center;
      }
      .card {
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 24px;
        padding: 32px 24px;
        max-width: 440px;
        width: 100%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      }
      .badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 9999px;
        background: #2563eb;
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        margin-bottom: 16px;
      }
      h1 { font-size: 22px; font-weight: 800; margin: 0 0 8px 0; }
      p { font-size: 13px; color: #a1a1aa; line-height: 1.5; margin: 0 0 20px 0; }
      .btn {
        display: block;
        width: 100%;
        padding: 14px;
        border-radius: 16px;
        background: #2563eb;
        color: #ffffff;
        font-weight: 700;
        font-size: 14px;
        text-decoration: none;
        box-sizing: border-box;
        border: none;
        cursor: pointer;
        margin-bottom: 12px;
      }
      .btn-secondary {
        background: #27272a;
        color: #e4e4e7;
      }
      .stats {
        background: #09090b;
        border-radius: 14px;
        padding: 14px;
        margin: 16px 0;
        text-align: left;
        font-size: 12px;
      }
      .stat-row { display: flex; justify-content: space-between; padding: 4px 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">OFFLINE STANDALONE PWA v1.1.3</div>
      <h1>${title}</h1>
      <p>${isArabic ? 'حزمة التطبيق الكاملة بدون إنترنت محفوظة محلياً على جهازك مع دعم التخزين الدائم IndexedDB.' : 'Your complete standalone application package saved directly on your device storage with permanent IndexedDB sync.'}</p>
      
      <div class="stats">
        <div class="stat-row">
          <span style="color:#71717a;">${isArabic ? 'الحسابات المحفوظة:' : 'Stored Accounts:'}</span>
          <strong>${currentData.accounts.length}</strong>
        </div>
        <div class="stat-row">
          <span style="color:#71717a;">${isArabic ? 'المعاملات:' : 'Transactions:'}</span>
          <strong>${currentData.transactions.length}</strong>
        </div>
        <div class="stat-row">
          <span style="color:#71717a;">${isArabic ? 'التصنيفات:' : 'Categories:'}</span>
          <strong>${currentData.categories.length}</strong>
        </div>
      </div>

      <button class="btn" onclick="openLiveApp()">${isArabic ? 'فتح التطبيق المباشر' : 'Open Live Application'}</button>
      <button class="btn btn-secondary" onclick="restoreBackup()">${isArabic ? 'تصدير البيانات بصيغة JSON' : 'Export Data Backup (JSON)'}</button>
    </div>

    <script>
      const APP_DATA = ${JSON.stringify(currentData)};
      
      // Save directly to device IndexedDB
      if (window.indexedDB) {
        const req = window.indexedDB.open('PersonalFinanceTrackerDB', 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('app_data_store')) {
            db.createObjectStore('app_data_store');
          }
        };
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('app_data_store', 'readwrite');
          const store = tx.objectStore('app_data_store');
          store.put(APP_DATA.accounts, 'accounts');
          store.put(APP_DATA.categories, 'categories');
          store.put(APP_DATA.transactions, 'transactions');
          store.put(APP_DATA.settings, 'settings');
        };
      }

      function openLiveApp() {
        window.location.href = 'https://netherdragon99.github.io/Money-Manger/';
      }

      function restoreBackup() {
        const blob = new Blob([JSON.stringify(APP_DATA, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'finance_tracker_backup_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    </script>
  </body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Personal_Finance_Tracker_v1.1.3.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
