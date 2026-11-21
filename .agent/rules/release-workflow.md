---
trigger: always_on
alwaysApply: true
description: Mandatory Beta-first release, versioning, offline PWA verification, and local commit workflow for every task in solv.
---

# `solv` Mandatory Release, Beta Channel & Offline Verification Rules

Apply these rules on **EVERY** task in this repository without exception:

1. **Always Work on the `beta` Branch**:
   - All changes, updates, and commits MUST happen on the **`beta`** branch (`channel: "beta"`, `isBeta: true`).
   - NEVER modify, merge into, or commit on `main` unless the user explicitly asks to publish a new public/official Stable release (`release:rollup`).
   - Keep `joinBeta` / channel preference strictly local to each device (never synced to cloud backups or overridden by remote settings).

2. **Automatic Patch Version Increment (`x.x.old+1`)**:
   - Every task MUST increment the last patch digit in `package.json` and root `version.json` using `npm run version:bump` (e.g., `2.0.0` → `2.0.1` → `2.0.2`).
   - Never hardcode stale version strings in `src/` — `CURRENT_APP_VERSION` is injected from `package.json` via Vite `define` (`__APP_VERSION__`).
   - Add a `isBeta: true` entry to `APP_RELEASE_NOTES` in `src/utils/appFeatures.ts` written in plain everyday English & friendly Egyptian Arabic (no developer jargon) so users on Stable never see unreleased beta changes until an official rollup.

3. **Mandatory Offline & PWA Verification Before Every Commit**:
   - Never keep static `public/version.json`, `public/sw.js`, or `public/registerSW.js` files that conflict with `vite-plugin-pwa`.
   - Always run:
     - `npm run lint` (TypeScript check)
     - `npx tsx scripts/verify-smart-budget.ts` (core budget & analytics regression suite)
     - `npm run build:all` (builds BOTH Stable `dist/` and Beta `dist/beta/` and runs `scripts/verify-offline-pwa.mjs` on both to verify zero duplicate precache URLs, valid `navigateFallback`, isolated channel caches, and valid `solv` manifests).
   - If any offline/PWA check fails, fix it before committing.

4. **Commit Locally Without Pushing**:
   - After all verifications pass, stage and create a clean local `git commit` on `beta`.
   - NEVER run `git push` unless the user explicitly requests pushing.
