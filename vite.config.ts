import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
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

  // Dedicated start_url for PWA manifest to ensure beta never reverts to stable
  const manifestStartUrl = isBeta
    ? (existingBase === './' ? './index.html' : `${existingBase}beta/index.html`)
    : (existingBase === './' ? './index.html' : `${existingBase}index.html`);

  const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'));
  const versionString = packageJson.version || '2.0.1';

  let buildId = 'dev';
  try {
    buildId = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    buildId = 'unknown';
  }

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
      'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
      '__APP_VERSION__': JSON.stringify(versionString),
      '__STABLE_BASELINE_VERSION__': JSON.stringify(stableVersionString),
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
          const appName = isBeta ? 'solv (Beta)' : 'solv';
          const shortName = isBeta ? 'solv Beta' : 'solv';
          const versionLabel = isBeta ? `Beta v${versionString}` : `v${versionString}`;
          let res = html.replace(/%APP_VERSION%/g, versionString);
          res = res.replace(/%BOOT_VERSION_LABEL%/g, versionLabel);
          res = res.replace(/Beta v%APP_VERSION%/g, versionLabel);
          if (isBeta) {
            res = res.replace(/<title>solv<\/title>/g, `<title>${appName}</title>`);
            res = res.replace(/content="solv"/g, `content="${shortName}"`);
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
            buildId,
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
        registerType: 'prompt',
        injectRegister: null,
        includeAssets: [],
        includeManifestIcons: false,
        manifest: {
          id: isBeta ? (channelScope === './' ? './beta' : `${channelScope}`) : base,
          name: isBeta ? 'solv (Beta)' : 'solv',
          short_name: isBeta ? 'solv Beta' : 'solv',
          description:
            'solv — an offline-first, OLED dark-themed personal finance & smart budget PWA with multi-account management, custom cycles, and live future-impact insights.',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          display_override: ['standalone'],
          orientation: 'any',
          start_url: manifestStartUrl,
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
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cacheId: isBeta ? 'solv-beta' : 'solv-stable',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: isBeta ? ['**/version.json'] : ['beta/**', '**/beta/**', '**/version.json'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          navigateFallback: 'index.html',
          navigateFallbackAllowlist: isBeta
            ? [/.*beta.*/, /^\/(index\.html)?$/]
            : [/^(?!.*beta).*$/],
          navigateFallbackDenylist: isBeta
            ? [/^\/api/, /version\.json$/]
            : [/^\/api/, /.*beta.*/, /version\.json$/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: isBeta ? 'solv-beta-google-fonts' : 'solv-stable-google-fonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: ({ request, url }) =>
                url.origin !== self.location.origin &&
                request.destination === 'image' &&
                !url.hostname.includes('firebase'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: isBeta ? 'solv-beta-avatars' : 'solv-stable-avatars',
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
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
