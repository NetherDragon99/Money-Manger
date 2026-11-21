#!/usr/bin/env node
/**
 * Generates all solv PWA, Apple Touch, Favicon, and SVG icons from the uploaded solv logo.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const DEFAULT_SOURCE = path.resolve(
  'C:/Users/Nether Dragon/.gemini/antigravity/brain/b06e93ab-2f03-4203-9866-e2689dbe7a05/.user_uploaded/media_1795212297932_93a0f7c9.jpg'
);

const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SOURCE;

async function main() {
  if (!fs.existsSync(sourcePath)) {
    console.error(`[icons:generate] Source icon not found at: ${sourcePath}`);
    process.exit(1);
  }

  const master = sharp(sourcePath).ensureAlpha();

  await master.clone().resize(512, 512, { fit: 'cover' }).png({ quality: 95 }).toFile(path.join(publicDir, 'pwa-512x512.png'));
  await master.clone().resize(192, 192, { fit: 'cover' }).png({ quality: 95 }).toFile(path.join(publicDir, 'pwa-192x192.png'));
  await master.clone().resize(180, 180, { fit: 'cover' }).png({ quality: 95 }).toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await master.clone().resize(64, 64, { fit: 'cover' }).png({ quality: 95 }).toFile(path.join(publicDir, 'favicon.png'));

  // Maskable 512x512: center logo at 80% inside #141414 safe background so adaptive masks never clip the S
  const innerBuf = await master.clone().resize(410, 410, { fit: 'contain' }).png().toBuffer();
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 20, g: 20, b: 20, alpha: 1 },
    },
  })
    .composite([{ input: innerBuf, gravity: 'center' }])
    .png({ quality: 95 })
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  // Clean SVG mark for solv
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="112" fill="#141414"/>
  <defs>
    <linearGradient id="solvTop" x1="120" y1="90" x2="390" y2="310" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#34D399"/>
    </linearGradient>
    <linearGradient id="solvBottom" x1="120" y1="210" x2="390" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6EE7B7"/>
      <stop offset="100%" stop-color="#2DD4BF"/>
    </linearGradient>
  </defs>
  <path d="M356 176C356 124 311 86 254 86C190 86 144 128 144 184C144 234 180 264 246 280L274 287C304 295 316 308 316 328C316 352 292 370 256 370C214 370 192 346 188 314H128C134 380 184 426 256 426C326 426 378 380 378 322C378 268 340 238 272 220L244 212C216 205 204 192 204 174C204 150 226 134 256 134C290 134 308 152 312 176H356Z" fill="url(#solvTop)"/>
  <path d="M144 316C144 378 192 426 258 426C326 426 378 380 378 320C378 272 344 242 280 225L254 218C228 211 214 198 214 180L154 196C154 242 190 272 254 288L282 295C310 302 320 315 320 332C320 356 296 374 258 374C216 374 194 348 190 316H144Z" fill="url(#solvBottom)" opacity="0.92"/>
</svg>\n`;
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svg, 'utf8');

  console.log('[icons:generate] Generated all solv icons in public/ successfully.');
}

main().catch((err) => {
  console.error('[icons:generate] Error:', err);
  process.exit(1);
});
