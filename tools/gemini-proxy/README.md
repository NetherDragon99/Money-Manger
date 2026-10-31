# Hybrid Gemini AI Key Resolution & Serverless Proxy Guide

Money Manager provides a resilient, privacy-first **4-Tier Hybrid AI Resolution Architecture** for its Smart Financial Advisor. This allows the app to function offline, with personal keys, via an authenticated serverless proxy, or using a domain-restricted shared key with a remote kill-switch—all while ensuring zero secrets are ever committed to git.

---

## 4-Tier Resolution Hierarchy (Strict Order)

When executing AI operations (budget allocation, health checks, what-if simulations, or pool classifications), Money Manager resolves credentials in this exact order:

1. **Tier (a): Personal User Key (`mm_gemini_api_key` in Advanced Settings)**
   - Stored in browser `localStorage` under `mm_gemini_api_key`.
   - Synced privately to the user's isolated RTDB path: `users/${uid}/secrets/gemini` (accessible only by that authenticated user).
   - Never placed in shared backups, export files, URL query params, or logs.
   - Takes precedence over all shared configurations.

2. **Tier (b): Authenticated Backend Proxy (`tools/gemini-proxy/`)**
   - Configured via `localStorage` key `mm_ai_proxy_url` or build-time environment variable `VITE_AI_PROXY_URL`.
   - Sends the user's Firebase Auth ID token (`Authorization: Bearer <idToken>`) to the proxy gateway.
   - Verifies the Firebase ID token (`iss`, `aud`, `exp`, `sub`) and enforces a per-user daily quota (`DAILY_USER_QUOTA`, default `30` requests/day per `uid`).
   - The serverless proxy keeps the master Gemini API key hidden server-side and always transmits it via the `x-goog-api-key` request header.

3. **Tier (c): Shared Authenticated Firebase RTDB Fallback (`app_config/gemini`)**
   - Fetched lazily on the first AI action from Firebase Realtime Database at path `app_config/gemini/apiKey` alongside the remote kill-switch `app_config/gemini/enabled`.
   - Fetched **only** for signed-in users (`auth != null`) and **only** after the user has explicitly turned ON the one-time AI consent toggle (OFF by default, with clear English/Arabic disclosure that aggregated budget numbers are sent to Google).
   - Protected by Firebase Security Rules (`database.rules.json`):
     ```json
     "app_config": {
       ".read": "auth != null",
       ".write": false
     }
     ```
   - **Strict Memory Isolation**: Held *strictly in runtime memory only* for the active session and cleared immediately on sign-out or when AI consent is revoked. It is **never** written to `localStorage`, `IndexedDB`, backups, exports, sync payloads, shares, console logs, error messages, or URL query parameters—and is always sent via the `x-goog-api-key` HTTP header.

4. **Tier (d): Silent Automatic Deterministic Fallback**
   - If offline, unauthenticated, disabled via kill-switch (`enabled: false`), consent is OFF, or on any `401`/`403`/`429`/network error, the app automatically and silently falls back to the deterministic local budgeting engine with zero user interruption or crash.
   - 100% of displayed numbers are always computed by the deterministic engine; AI responses are strictly schema-validated JSON used only for advisory text and percentage suggestions.

---

## Deployment Options

Choose either **Option A** (simplest, zero server infrastructure) or **Option B** (serverless gateway with Firebase ID token verification and daily quota).

---

### Option A: Domain-Restricted Firebase Shared Key + Kill-Switch

#### Step 1: Create and Restrict API Key in Google Cloud Console
1. Go to [Google AI Studio](https://aistudio.google.com/) or [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Generate a new API key.
3. Edit the key in Google Cloud Console:
   - **API restrictions**: Select **Restrict key** and choose only **Generative Language API**.
   - **Application restrictions**: Select **Websites (HTTP referrers)** and add your production domain(s):
     - `https://<your-username>.github.io/*`
     - `http://localhost:*` (optional, for local development)
4. Save the restrictions.

#### Step 2: Store Key & Kill-Switch in Firebase Console
1. Open your project in the [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **Build** &rarr; **Realtime Database** &rarr; **Data**.
3. Create the path `/app_config/gemini` with `apiKey` and `enabled`:
   ```json
   {
     "app_config": {
       "gemini": {
         "apiKey": "<YOUR_DOMAIN_RESTRICTED_KEY>",
         "enabled": true
       }
     }
   }
   ```
   *(Set `"enabled": false` at any time to immediately disable shared AI access via the remote kill-switch).*
4. Verify your `database.rules.json` contains:
   ```json
   "app_config": {
     ".read": "auth != null",
     ".write": false
   }
   ```
5. Deploy database rules if not already updated:
   ```bash
   firebase deploy --only database
   ```

---

### Option B: Cloudflare Worker AI Proxy (`tools/gemini-proxy/`)

#### Step 1: Install Wrangler CLI
```bash
npm install -g wrangler
```

#### Step 2: Set the Secret Key
Navigate to `tools/gemini-proxy`:
```bash
cd tools/gemini-proxy
npx wrangler secret put GEMINI_API_KEY
```
*(Optional)* To enable cryptographic token lookup against Firebase Identity Toolkit, also set `FIREBASE_WEB_API_KEY` and `FIREBASE_PROJECT_ID` in `wrangler.toml` or via secrets, and optionally bind a Cloudflare KV namespace named `QUOTA_KV` for distributed daily quota tracking.

#### Step 3: Deploy the Worker
```bash
npx wrangler deploy
```

#### Step 4: Configure Money Manager to Use the Proxy
- **Build-Time (GitHub Actions / Environment)**:
  ```bash
  VITE_AI_PROXY_URL=https://money-manager-gemini-proxy.<your-subdomain>.workers.dev
  ```
- **Runtime (Browser)**:
  ```javascript
  localStorage.setItem('mm_ai_proxy_url', 'https://money-manager-gemini-proxy.<your-subdomain>.workers.dev');
  ```

---

## Security Audit Verification

Confirm that no raw API keys are committed in source code:
```bash
git grep -i "AIza"
```
The output should return empty (exit code 1).
