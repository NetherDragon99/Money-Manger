import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';
  const base = isDev ? '/' : './';
  const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'));

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'html-version-transform',
        transformIndexHtml(html: string) {
          return html.replace(/%APP_VERSION%/g, packageJson.version || '1.1.56');
        },
      },
      VitePWA({
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
          id: base,
          name: 'Personal Finance Tracker',
          short_name: 'FinanceApp',
          description:
            'An offline-first, OLED dark-themed personal finance tracker PWA with running balances, multi-account management, custom cycles, and budgeting.',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          display_override: ['standalone'],
          orientation: 'any',
          start_url: base,
          scope: base,
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
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          navigateFallback: isDev ? '/index.html' : 'index.html',
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching: [
            {
              urlPattern: ({ request }) =>
                request.destination === 'document' ||
                request.destination === 'script' ||
                request.destination === 'style' ||
                request.destination === 'image' ||
                request.destination === 'font',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'app-offline-cache',
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
