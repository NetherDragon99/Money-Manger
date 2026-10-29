import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve';
  const isBeta = mode === 'beta' || process.env.VITE_APP_CHANNEL === 'beta';
  const channel = isBeta ? 'beta' : 'stable';

  // Base URL configuration:
  // Stable keeps the exact existing base: isDev ? '/' : './'
  // When process.env.BASE_URL is provided (e.g. on GitHub Pages /Money-Manger/), normalize and append beta/ for beta
  const rawBase = process.env.BASE_URL || (isDev ? '/' : './');
  const existingBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  const betaBase = existingBase === './' ? './' : `${existingBase}beta/`;
  const base = isBeta ? betaBase : rawBase;

  // Channel scope for service worker and manifest
  const channelScope = isBeta
    ? (existingBase === './' ? './' : `${existingBase}beta/`)
    : base;

  const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'));
  const versionString = packageJson.version || '1.1.63';

  // The last official stable version this build is based on (beta builds keep their own version).
  let stableVersionString = versionString;
  if (isBeta) {
    try {
      const rootVersion = JSON.parse(fs.readFileSync(path.resolve('version.json'), 'utf-8'));
      if (rootVersion?.stableVersion) stableVersionString = String(rootVersion.stableVersion);
    } catch {
      // keep fallback
    }
  }

  return {
    base,
    define: {
      'import.meta.env.VITE_APP_CHANNEL': JSON.stringify(channel),
    },
    build: {
      outDir: isBeta ? 'dist/beta' : 'dist',
      emptyOutDir: !isBeta,
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'html-version-transform',
        transformIndexHtml(html: string) {
          const appName = isBeta ? 'Personal Finance Tracker (Beta)' : 'Personal Finance Tracker';
          const shortName = isBeta ? 'FinanceApp Beta' : 'FinanceApp';
          const versionLabel = isBeta ? `Beta v${versionString}` : `v${versionString}`;
          let res = html.replace(/%APP_VERSION%/g, versionString);
          res = res.replace(/%BOOT_VERSION_LABEL%/g, versionLabel);
          res = res.replace(/Beta v%APP_VERSION%/g, versionLabel);
          if (isBeta) {
            res = res.replace(/<title>Personal Finance Tracker<\/title>/g, `<title>${appName}</title>`);
            res = res.replace(/content="FinanceApp"/g, `content="${shortName}"`);
          }
          return res;
        },
      },
      {
        name: 'channel-version-json',
        generateBundle() {
          const versionData = {
            version: versionString,
            channel,
            isBeta,
            stableVersion: stableVersionString,
          };
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify(versionData, null, 2),
          });
        },
      },
      VitePWA({
        scope: channelScope,
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: [
          'favicon.png',
          'apple-touch-icon.png',
          'icon.svg',
          'version.json',
          'pwa-192x192.png',
          'pwa-512x512.png',
        ],
        manifest: {
          id: isBeta ? 'mm-beta' : base,
          name: isBeta ? 'Personal Finance Tracker (Beta)' : 'Personal Finance Tracker',
          short_name: isBeta ? 'FinanceApp Beta' : 'FinanceApp',
          description:
            'An offline-first, OLED dark-themed personal finance tracker PWA with running balances, multi-account management, custom cycles, and budgeting.',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          display_override: ['standalone'],
          orientation: 'any',
          start_url: channelScope,
          scope: channelScope,
          categories: ['finance', 'productivity', 'utilities'],
          prefer_related_applications: false,
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cacheId: isBeta ? 'mm-beta' : undefined,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
          globIgnores: isBeta ? [] : ['beta/**', '**/beta/**'],
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          navigateFallback: isDev ? '/index.html' : 'index.html',
          navigateFallbackDenylist: isBeta ? [/^\/api/] : [/^\/api/, /\/beta\//],
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) => {
                if (!isBeta && /\/beta\//.test(url.pathname)) {
                  return false;
                }
                return (
                  request.destination === 'document' ||
                  request.destination === 'script' ||
                  request.destination === 'style' ||
                  request.destination === 'image' ||
                  request.destination === 'font'
                );
              },
              handler: 'NetworkFirst',
              options: {
                cacheName: isBeta ? 'app-offline-cache-beta' : 'app-offline-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                networkTimeoutSeconds: 2,
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve('.'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
