#!/usr/bin/env node
/**
 * Post-Build Offline PWA & Channel Isolation Verifier
 * Prevents broken Service Workers, duplicate precache revisions, missing navigation fallbacks,
 * or cross-channel cache collisions from ever shipping.
 *
 * Usage:
 *   node scripts/verify-offline-pwa.mjs dist
 *   node scripts/verify-offline-pwa.mjs dist/beta --beta
 *   node scripts/verify-offline-pwa.mjs --all
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function fail(targetLabel, message) {
  console.error(`\n[verify:offline] FAIL (${targetLabel}): ${message}\n`);
  process.exit(1);
}

function verifyTarget(dirPath, isBeta) {
  const label = isBeta ? 'BETA' : 'STABLE';
  const absDir = path.resolve(rootDir, dirPath);

  if (!fs.existsSync(absDir)) {
    fail(label, `Build directory does not exist: ${absDir}`);
  }

  const requiredFiles = ['sw.js', 'manifest.webmanifest', 'index.html', 'version.json'];
  for (const file of requiredFiles) {
    const p = path.join(absDir, file);
    if (!fs.existsSync(p)) {
      fail(label, `Missing required output file: ${file}`);
    }
  }

  const swPath = path.join(absDir, 'sw.js');
  const swContent = fs.readFileSync(swPath, 'utf8');
  if (swContent.length < 400 || !swContent.includes('precacheAndRoute')) {
    fail(label, 'sw.js is not a valid compiled Workbox Service Worker.');
  }

  // 1. Check strict channel cache prefix isolation
  const expectedPrefix = isBeta ? 'solv-beta' : 'solv-stable';
  if (!swContent.includes(expectedPrefix)) {
    fail(label, `sw.js missing expected isolated cacheId prefix "${expectedPrefix}".`);
  }

  // 2. Parse precacheAndRoute([...]) entries and detect ANY duplicate URLs
  const precacheMatch = swContent.match(/precacheAndRoute\(\s*\[(.*?)\]\s*,/s);
  if (!precacheMatch) {
    fail(label, 'Could not find precacheAndRoute([...]) array in sw.js.');
  }

  const entriesRaw = precacheMatch[1];
  const entryRegex = /\{\s*url:\s*"([^"]+)"\s*,\s*revision:\s*(null|"[^"]*")\s*\}/g;
  const seenUrls = new Map();
  let m;
  let entryCount = 0;

  while ((m = entryRegex.exec(entriesRaw)) !== null) {
    entryCount++;
    const url = m[1].replace(/^\.\//, '');
    const rev = m[2];
    if (seenUrls.has(url)) {
      fail(
        label,
        `Duplicate precache URL detected in sw.js: "${url}" (revisions: ${seenUrls.get(url)} vs ${rev}). This crashes Workbox install and breaks offline mode!`
      );
    }
    seenUrls.set(url, rev);
  }

  if (entryCount === 0) {
    fail(label, 'precacheAndRoute() has 0 entries.');
  }

  // Ensure version.json is NOT in precache (live update endpoint must stay un-precached)
  if (seenUrls.has('version.json')) {
    fail(label, 'version.json must NOT be in precacheAndRoute (causes conflicting revisions).');
  }

  // 3. Ensure core app shell files are precached
  if (!seenUrls.has('index.html')) {
    fail(label, 'index.html is missing from precacheAndRoute.');
  }
  if (!seenUrls.has('manifest.webmanifest')) {
    fail(label, 'manifest.webmanifest is missing from precacheAndRoute.');
  }

  const urlsList = Array.from(seenUrls.keys());
  if (!urlsList.some((u) => u.startsWith('assets/') && u.endsWith('.js'))) {
    fail(label, 'No bundled JS files under assets/ found in precacheAndRoute.');
  }
  if (!urlsList.some((u) => u.startsWith('assets/') && u.endsWith('.css'))) {
    fail(label, 'No bundled CSS files under assets/ found in precacheAndRoute.');
  }

  // 4. Verify NavigationRoute fallback points to precached index.html
  const navMatch = swContent.match(/createHandlerBoundToURL\(\s*"([^"]+)"\s*\)/);
  if (!navMatch) {
    fail(label, 'NavigationRoute createHandlerBoundToURL(...) is missing in sw.js.');
  }
  const navTarget = navMatch[1].replace(/^\.\//, '');
  if (!seenUrls.has(navTarget)) {
    fail(label, `NavigationRoute target "${navMatch[1]}" is NOT in precacheAndRoute!`);
  }

  // 5. Verify runtimeCaching does NOT intercept navigation documents with NetworkFirst
  if (/document"\s*===\s*[a-zA-Z0-9_]+\.destination|[a-zA-Z0-9_]+\.destination\s*===\s*"document"/.test(swContent)) {
    fail(label, 'sw.js intercepts request.destination === "document" in runtimeCaching; NavigationRoute must serve cached index.html directly.');
  }

  // 6. Verify manifest.webmanifest branding, icons, and channel ID
  const manifest = JSON.parse(fs.readFileSync(path.join(absDir, 'manifest.webmanifest'), 'utf8'));
  if (!manifest.name || !manifest.name.toLowerCase().startsWith('solv')) {
    fail(label, `Manifest name must start with "solv", got "${manifest.name}".`);
  }
  if (!manifest.short_name || !manifest.short_name.toLowerCase().startsWith('solv')) {
    fail(label, `Manifest short_name must start with "solv", got "${manifest.short_name}".`);
  }
  if (manifest.display !== 'standalone') {
    fail(label, `Manifest display must be "standalone", got "${manifest.display}".`);
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) {
    fail(label, 'Manifest must define at least 2 icons.');
  }
  for (const icon of manifest.icons) {
    const iconClean = String(icon.src || '').replace(/^\.\//, '');
    if (!fs.existsSync(path.join(absDir, iconClean))) {
      fail(label, `Manifest icon file missing in build output: ${iconClean}`);
    }
    if (!seenUrls.has(iconClean)) {
      fail(label, `Manifest icon "${iconClean}" is NOT precached in sw.js.`);
    }
  }

  // 7. Verify version.json channel & version match package.json
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const verJson = JSON.parse(fs.readFileSync(path.join(absDir, 'version.json'), 'utf8'));
  if (verJson.version !== pkg.version) {
    fail(label, `dist version.json (${verJson.version}) does not match package.json (${pkg.version}).`);
  }
  if (Boolean(verJson.isBeta) !== Boolean(isBeta)) {
    fail(label, `dist version.json isBeta (${verJson.isBeta}) does not match channel (${label}).`);
  }

  // 8. Verify index.html contains manifest link and solv title
  const html = fs.readFileSync(path.join(absDir, 'index.html'), 'utf8');
  if (!html.includes('manifest.webmanifest')) {
    fail(label, 'index.html is missing <link rel="manifest" href="...manifest.webmanifest">.');
  }
  if (!/<title>\s*solv/i.test(html)) {
    fail(label, 'index.html <title> must start with "solv".');
  }

  console.log(
    `[verify:offline] PASS (${label}) — v${verJson.version}, ${entryCount} unique precache entries, cacheId=${expectedPrefix}, nav=${navMatch[1]}`
  );
}

const args = process.argv.slice(2);
if (args.includes('--all')) {
  verifyTarget('dist', false);
  verifyTarget('dist/beta', true);
} else {
  const isBeta = args.includes('--beta');
  const dirArg = args.find((a) => !a.startsWith('--')) || (isBeta ? 'dist/beta' : 'dist');
  verifyTarget(dirArg, isBeta);
}
