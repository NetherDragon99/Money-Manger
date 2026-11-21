#!/usr/bin/env node
/**
 * Atomically bumps the app patch version (x.x.old+1) in package.json and version.json.
 * Always targets the active beta workflow unless --channel stable is explicitly passed.
 *
 * Usage:
 *   node scripts/bump-version.mjs
 *   node scripts/bump-version.mjs --set 2.0.5
 *   node scripts/bump-version.mjs --channel stable --set 2.1.0
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const verPath = path.join(rootDir, 'version.json');

const args = process.argv.slice(2);
let explicitVersion = null;
let explicitChannel = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--set' && args[i + 1]) {
    explicitVersion = args[++i];
  } else if (args[i] === '--channel' && args[i + 1]) {
    explicitChannel = args[++i];
  }
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const ver = fs.existsSync(verPath) ? JSON.parse(fs.readFileSync(verPath, 'utf8')) : {};

const currentVersion = String(pkg.version || ver.version || '2.0.0').trim();
let nextVersion = explicitVersion;

if (!nextVersion) {
  const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    console.error(`[version:bump] Invalid semver format in package.json: "${currentVersion}"`);
    process.exit(1);
  }
  const [, major, minor, patch] = match;
  nextVersion = `${major}.${minor}.${Number(patch) + 1}`;
}

if (!/^\d+\.\d+\.\d+$/.test(nextVersion)) {
  console.error(`[version:bump] Invalid target version: "${nextVersion}"`);
  process.exit(1);
}

const channel = explicitChannel || ver.channel || 'beta';
const isBeta = channel === 'beta';
const stableVersion = isBeta
  ? (ver.stableVersion && ver.stableVersion !== currentVersion ? ver.stableVersion : '1.1.61')
  : nextVersion;

pkg.version = nextVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

const nextVerJson = {
  version: nextVersion,
  channel,
  isBeta,
  stableVersion,
};
fs.writeFileSync(verPath, JSON.stringify(nextVerJson, null, 2) + '\n', 'utf8');

console.log(`[version:bump] ${currentVersion} -> ${nextVersion} (channel=${channel}, stableVersion=${stableVersion})`);
