#!/usr/bin/env node
/**
 * Developer-only release-notes rollup (never imported by the app, never bundled).
 *
 * Merges every beta entry (isBeta: true, not yet rolled up) that is newer than the previous
 * stable version into ONE new official entry (isBeta: false) and marks the merged beta entries
 * with `rolledUpInto: '<newVersion>'`.
 *
 * It NEVER writes release text itself: it only merges and de-duplicates what each beta entry's
 * `highlights` already say. The new entry's title must be supplied by the developer.
 *
 * Usage:
 *   npm run release:rollup -- <newStableVersion> --title-en "..." --title-ar "..." [--dry-run]
 *                             [--previous <version>] [--file <path>]
 *
 * Fails (exit code 1) if any highlight/title contains developer jargon.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.resolve(__dirname, '..', 'src', 'utils', 'appFeatures.ts');

const JARGON_WORDS = [
  'api', 'firebase', 'rtdb', 'tdz', 'hook', 'hooks', 'refactor', 'refactored', 'refactoring',
  'bundle', 'bundled', 'cache', 'cached', 'service worker', 'commit', 'commits',
];

// Patterns that look like file names/extensions or code identifiers.
const JARGON_PATTERNS = [
  [/\b[\w./-]+\.(tsx?|jsx?|mjs|cjs|json|css|html|md|yml|yaml)\b/i, 'file name or extension'],
  [/`[^`]*`/, 'inline code'],
  [/\b[a-z]+[A-Z][A-Za-z0-9]*\b/, 'camelCase identifier'],
  [/\b[A-Za-z0-9]+_[A-Za-z0-9_]+\b/, 'snake_case identifier'],
  [/\w+\(\)/, 'function call'],
  [/\$\{[^}]*\}/, 'template expression'],
  [/\b[\w-]+\/[\w-]+\//, 'path'],
];

function fail(message) {
  console.error(`\n[release:rollup] ERROR: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { dryRun: false, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--title-en') args.titleEn = argv[++i];
    else if (a === '--title-ar') args.titleAr = argv[++i];
    else if (a === '--previous') args.previous = argv[++i];
    else if (a === '--file') args.file = argv[++i];
    else if (a.startsWith('--')) fail(`Unknown flag: ${a}`);
    else args.positional.push(a);
  }
  return args;
}

function cmpVersion(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function findJargon(text) {
  const lower = text.toLowerCase();
  for (const word of JARGON_WORDS) {
    const re = new RegExp(`(^|[^a-z])${word.replace(' ', '\\s+')}([^a-z]|$)`, 'i');
    if (re.test(lower)) return `"${word}"`;
  }
  for (const [re, label] of JARGON_PATTERNS) {
    const m = text.match(re);
    if (m) return `${label} ("${m[0]}")`;
  }
  return null;
}

function extractNotes(source) {
  const startMarker = /export const APP_RELEASE_NOTES\s*:\s*ReleaseNote\[\]\s*=\s*/;
  const m = startMarker.exec(source);
  if (!m) fail('Could not find APP_RELEASE_NOTES in the file.');
  const arrStart = m.index + m[0].length;
  const endIdx = source.indexOf('\n];', arrStart);
  if (endIdx === -1) fail('Could not find the end of APP_RELEASE_NOTES.');
  const literal = source.slice(arrStart, endIdx + 3).replace(/;\s*$/, '');
  let notes;
  try {
    notes = new Function(`return ${literal}`)();
  } catch (err) {
    fail(`Could not parse APP_RELEASE_NOTES: ${err.message}`);
  }
  return { notes, arrStart };
}

function dedupe(lines) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = line.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line.trim());
  }
  return out;
}

function quote(s) {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const newVersion = args.positional[0];
  if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
    fail('Provide the new stable version, for example: npm run release:rollup -- 1.1.65 --title-en "..." --title-ar "..."');
  }
  if (!args.titleEn || !args.titleAr) {
    fail('--title-en and --title-ar are required (this script never writes release text itself).');
  }

  const file = path.resolve(args.file || DEFAULT_FILE);
  if (!fs.existsSync(file)) fail(`File not found: ${file}`);
  const source = fs.readFileSync(file, 'utf8');
  const { notes } = extractNotes(source);

  if (notes.some((n) => n.version === newVersion)) fail(`Version ${newVersion} already exists in the release notes.`);

  const previousStable =
    args.previous ||
    notes
      .filter((n) => n.isBeta !== true)
      .map((n) => n.version)
      .sort(cmpVersion)
      .pop();
  if (!previousStable) fail('Could not determine the previous stable version. Pass --previous <version>.');
  if (cmpVersion(newVersion, previousStable) <= 0) {
    fail(`New version ${newVersion} must be newer than the previous stable ${previousStable}.`);
  }

  const betaEntries = notes.filter(
    (n) => n.isBeta === true && !n.rolledUpInto && cmpVersion(n.version, previousStable) > 0
  );
  if (betaEntries.length === 0) fail(`No un-rolled beta entries newer than ${previousStable} were found.`);

  const en = [];
  const ar = [];
  const problems = [];

  const check = (label, text) => {
    const hit = findJargon(text);
    if (hit) problems.push(`${label}: contains developer jargon - ${hit}: "${text}"`);
  };
  check('--title-en', args.titleEn);
  check('--title-ar', args.titleAr);

  // Oldest first so the merged list reads chronologically.
  for (const entry of [...betaEntries].sort((a, b) => cmpVersion(a.version, b.version))) {
    const hEn = entry.highlights?.en || [];
    const hAr = entry.highlights?.ar || [];
    if (hEn.length === 0 || hAr.length === 0) {
      problems.push(`v${entry.version}: needs both English and Arabic highlights.`);
    }
    hEn.forEach((line) => check(`v${entry.version} (en)`, line));
    hAr.forEach((line) => check(`v${entry.version} (ar)`, line));
    en.push(...hEn);
    ar.push(...hAr);
  }

  if (problems.length > 0) {
    fail(`Fix these beta highlights first (use short everyday language):\n  - ${problems.join('\n  - ')}`);
  }

  const merged = {
    version: newVersion,
    releaseDate: formatDate(new Date()),
    isBeta: false,
    title: { en: args.titleEn, ar: args.titleAr },
    highlights: { en: dedupe(en), ar: dedupe(ar) },
  };

  const block =
    `  {\n` +
    `    version: ${quote(merged.version)},\n` +
    `    isBeta: false,\n` +
    `    releaseDate: ${quote(merged.releaseDate)},\n` +
    `    title: {\n      en: ${quote(merged.title.en)},\n      ar: ${quote(merged.title.ar)},\n    },\n` +
    `    highlights: {\n      en: [\n${merged.highlights.en.map((l) => `        ${quote(l)},`).join('\n')}\n      ],\n` +
    `      ar: [\n${merged.highlights.ar.map((l) => `        ${quote(l)},`).join('\n')}\n      ],\n    },\n` +
    `  },\n`;

  console.log(`Previous stable : ${previousStable}`);
  console.log(`New stable      : ${newVersion}`);
  console.log(`Rolled up betas : ${betaEntries.map((n) => n.version).join(', ')}`);
  console.log(`\n--- New official entry ---\n${block}`);

  if (args.dryRun) {
    console.log('[release:rollup] Dry run: no files were changed.');
    return;
  }

  // Insert the new entry at the top and mark merged beta entries with rolledUpInto.
  const m = /export const APP_RELEASE_NOTES\s*:\s*ReleaseNote\[\]\s*=\s*\[\r?\n/.exec(source);
  let out = source.slice(0, m.index + m[0].length) + block + source.slice(m.index + m[0].length);
  for (const entry of betaEntries) {
    const re = new RegExp(`(version: '${entry.version.replace(/\./g, '\\.')}',\\r?\\n\\s*isBeta: true,)(\\r?\\n)`);
    if (!re.test(out)) fail(`Could not mark v${entry.version} as rolled up (expected "isBeta: true," right after its version line).`);
    out = out.replace(re, `$1$2    rolledUpInto: '${newVersion}',$2`);
  }
  fs.writeFileSync(file, out, 'utf8');
  console.log(`[release:rollup] Updated ${file}`);
}

main();
