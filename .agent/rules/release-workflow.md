---
trigger: always_on
alwaysApply: true
description: Mandatory Beta-first release, strict Stable/Beta version & cache isolation, offline PWA verification, GitHub Pages deploy checks, and local commit workflow for every task in solv.
---

# `solv` Mandatory Release, Beta Channel & Offline Verification Rules

Apply these rules on **EVERY** task in this repository without exception:

1. **Always Work on the `beta` Branch**:
   - All changes, updates, and commits MUST happen on the **`beta`** branch (`channel: "beta"`, `isBeta: true`).
   - NEVER modify, merge into, or commit on `main` unless the user explicitly asks to publish a new public/official Stable release (`release:rollup`).
   - Keep `joinBeta` / channel preference (`mm_preferred_channel`) strictly local to each device (never synced to cloud backups or overridden by remote settings).

2. **Strict Stable vs. Beta Version Split & Automatic Patch Increment (`x.x.old+1`)**:
   - Every app/code task MUST increment the last patch digit in `package.json` and root `version.json` using `npm run version:bump` (e.g., `2.0.0` → `2.0.1` → `2.0.2`). *(Pure internal `.agent/rules/` edits with zero app code changes do not require a user-facing version bump.)*
   - **`stableVersion` MUST NEVER drift or regress**:
     - `package.json` holds the active **Beta** version (e.g. `2.0.1`, `2.0.2`).
     - Root `version.json` MUST preserve `"stableVersion"` equal to the actual latest official Stable release deployed on `main` (e.g. `"2.0.0"`). NEVER let `bump-version.mjs` fall back to an old version (like `1.1.61`) or overwrite `stableVersion` with the beta patch version.
     - `vite.config.ts` MUST inject `stableVersion` as `__APP_VERSION__` for Stable builds and `package.json` version for Beta builds so Beta patch bumps NEVER leak into Stable.
   - Never hardcode stale version strings in `src/` — `CURRENT_APP_VERSION` is injected via Vite `define` (`__APP_VERSION__`) and `STABLE_BASELINE_VERSION` via `__STABLE_BASELINE_VERSION__`.
   - For every bumped Beta version, add an `isBeta: true` entry to `APP_RELEASE_NOTES` in `src/utils/appFeatures.ts` written in plain everyday English & friendly Egyptian Arabic (zero developer jargon) so Stable users never see unreleased Beta changes until an official rollup.

3. **Strict Cross-Channel Cache Isolation & Auto-Purge**:
   - Stable caches MUST be prefixed `solv-stable*` and Beta caches MUST be prefixed `solv-beta*`.
   - At module boot in `src/App.tsx` (before React mounts), both `reconcileBetaChannelStartup()` and `purgeOtherChannelCaches()` MUST run so switching into Beta evicts stale `solv-stable*` caches and switching into Stable evicts `solv-beta*` caches.
   - Never keep static `public/version.json`, `public/sw.js`, or `public/registerSW.js` files that conflict with `vite-plugin-pwa`.

4. **Prevent Infinite Update / Refresh Loops**:
   - NEVER include a version number (e.g., `2.0.0`, `2.0.2`) in a `main` commit message unless that exact version is actually built and served by live `version.json` on GitHub Pages. Older deployed clients fall back to reading the latest commit message on `main` and will loop endlessly trying to update if the commit message advertises a newer version than the live `version.json`.
   - If a retrigger commit on `main` is ever needed, its message MUST contain **no** version numbers (e.g., `chore: retrigger pages deploy`).

5. **Mandatory Offline & PWA Verification Before Every Commit**:
   - Always run before committing:
     - `npm run lint` (TypeScript check — must exit 0)
     - `npx tsx scripts/verify-smart-budget.ts` (all 9 Smart Budget, Impact, Filter & Channel regression suites must pass)
     - `npm run build:all` (builds BOTH Stable `dist/` and Beta `dist/beta/` and runs `scripts/verify-offline-pwa.mjs` on both to verify zero duplicate precache URLs, valid `navigateFallback`, isolated channel caches `solv-stable` vs `solv-beta`, expected `version.json` per channel, and valid `solv` manifests).
   - If any offline/PWA check fails, fix it before committing.

6. **Commit Locally Without Pushing — and Verify Live Deploys Whenever Pushing**:
   - After all verifications pass, stage and create a clean local `git commit` on `beta`.
   - NEVER run `git push` unless the user explicitly requests pushing.
   - Whenever the user tests on the live GitHub Pages URL or installed PWA, explicitly note whether the latest commit has been pushed yet so there is zero confusion between local commits and live deployment.
   - Whenever a push **IS** explicitly requested and executed (on `beta` or `main`):
     1. Check that `origin/main` is on the expected official Stable release commit (never lagging behind on an ancient version).
     2. Wait for and verify the `Deploy to GitHub Pages` workflow run via the GitHub Actions API (`https://api.github.com/repos/NetherDragon99/Money-Manger/actions/runs?per_page=3`) — NEVER assume a push succeeded just because `git push` exited 0 (GitHub Pages can fail transiently with `"No artifacts named github-pages"`).
     3. After the workflow reports `completed/success`, fetch and verify BOTH live endpoints:
        - `https://netherdragon99.github.io/Money-Manger/version.json` (must match official Stable version)
        - `https://netherdragon99.github.io/Money-Manger/beta/version.json` (must match latest Beta version & `buildId`)
     4. Only report deployment success after both live endpoints confirm the exact expected versions.
