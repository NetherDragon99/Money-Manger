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
  // When process.env.BASE_URL is provided (e.g. on GitHub Pages /solv/), normalize and append beta/ for beta
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

  // Beta builds use the full package.json version (e.g. 2.0.1).
  // Stable builds ALWAYS use stableVersion from version.json (e.g. 2.0.0) so
  // beta patch bumps NEVER change what stable users see.
  let rootVersionJson: Record<string, string> = {};
  try {
    rootVersionJson = JSON.parse(fs.readFileSync(path.resolve('version.json'), 'utf-8'));
  } catch { /* ignore */ }

  const betaVersionString: string = packageJson.version || '2.0.1';
  const stableVersionString: string = rootVersionJson.stableVersion || packageJson.version || '2.0.0';
  // The build-time version shown in the app:
  // - Stable: stableVersion (2.0.0)
  // - Beta:   full package version (2.0.1, 2.0.2, …)
  const versionString: string = isBeta ? betaVersionString : stableVersionString;

  let buildId = 'dev';
  try {
    buildId = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    buildId = 'unknown';
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
          // Strict branding rule: App name is ALWAYS "solv" on both Stable and Beta.
          // "Beta" appears ONLY beside the version label (e.g., "Beta v2.0.2").
          const versionLabel = isBeta ? `Beta v${versionString}` : `v${versionString}`;
          let res = html.replace(/%APP_VERSION%/g, versionString);
          res = res.replace(/%BOOT_VERSION_LABEL%/g, versionLabel);
          res = res.replace(/Beta v%APP_VERSION%/g, versionLabel);
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
          name: 'solv',
          short_name: 'solv',
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
