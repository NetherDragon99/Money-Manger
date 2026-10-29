# Hybrid Gemini AI Key Resolution & Serverless Proxy Guide

Money Manager provides a resilient, privacy-first **4-Tier Hybrid AI Resolution Architecture** for its Smart Financial Advisor. This allows the app to function offline, with personal keys, via an authenticated serverless proxy, or using a domain-restricted shared key—all while ensuring zero secrets are ever committed to git.

---

## 4-Tier Resolution Hierarchy

When executing AI operations (budget allocation, health checks, what-if simulations, or pool classifications), Money Manager resolves credentials in this exact order:

1. **Tier 1: Personal User Key**
   - Stored in browser `localStorage` under `mm_gemini_api_key`.
   - Synced privately to the user's isolated RTDB path: `users/${uid}/secrets/gemini` (accessible only by that authenticated user).
   - Never placed in shared backups, export files, or logs.
   - Takes precedence over all shared configurations.

2. **Tier 2: Authenticated Serverless Proxy**
   - Configured via `localStorage` key `mm_ai_proxy_url` or build-time environment variable `VITE_AI_PROXY_URL`.
   - Sends the user's Firebase Auth ID token (`Authorization: Bearer <idToken>`) to the proxy gateway.
   - The serverless proxy keeps the master Gemini API key hidden server-side.

3. **Tier 3: Shared Authenticated App Key**
   - Fetched on-demand from Firebase Realtime Database at path `app_config/gemini/apiKey`.
   - Protected by Firebase Security Rules:
     ```json
     "app_config": {
       ".read": "auth != null",
       ".write": false
     }
     ```
   - Only signed-in users can read the key; only the database owner can configure it via the Firebase Console.
   - **Strict Memory Isolation**: Cached *only in runtime memory* for the active session. It is **never** written to `localStorage`, `IndexedDB`, exported backups, or console logs.

4. **Tier 4: Automatic Silent Deterministic Fallback**
   - If offline, unauthenticated, or if any API call encounters network failure, rate limiting (`429`), or auth errors (`401`/`403`), the app automatically and silently falls back to the deterministic local budgeting engine with zero user interruption or crash.

---

## Deployment Options

Choose either **Option A** (simplest, zero infrastructure) or **Option B** (serverless gateway with hidden key).

---

### Option A: Domain-Restricted Firebase Shared Key (Zero-Deploy, Recommended)

This approach requires no server or worker deployment. It leverages Google Cloud key restrictions combined with Firebase Realtime Database authentication rules.

#### Step 1: Create and Restrict API Key in Google Cloud Console
1. Go to [Google AI Studio](https://aistudio.google.com/) or [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Generate a new API key.
3. Edit the key in Google Cloud Console:
   - **API restrictions**: Select **Restrict key** and choose only **Generative Language API**.
   - **Application restrictions**: Select **Websites (HTTP referrers)** and add your production domain(s):
     - `https://<your-username>.github.io/*`
     - `http://localhost:*` (optional, for local development)
4. Save the restrictions. (The key cannot be abused from unauthorized origins).

#### Step 2: Store Key in Firebase Console
1. Open your project in the [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **Build** &rarr; **Realtime Database** &rarr; **Data**.
3. Create the path `/app_config/gemini` and set `apiKey`:
   ```json
   {
     "app_config": {
       "gemini": {
         "apiKey": "<YOUR_DOMAIN_RESTRICTED_KEY>"
       }
     }
   }
   ```
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

Authenticated users will now automatically and seamlessly use this key without entering a personal key.

---

### Option B: Cloudflare Worker AI Proxy (Serverless Gateway)

If you prefer to keep the Gemini API key completely hidden on the server side, deploy the included Cloudflare Worker.

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
When prompted, paste your Gemini API key from Google AI Studio.

#### Step 3: Deploy the Worker
```bash
npx wrangler deploy
```
Wrangler will output your live worker URL (e.g., `https://money-manager-gemini-proxy.<your-subdomain>.workers.dev`).

#### Step 4: Configure Money Manager to Use the Proxy
You can configure the proxy in either of two ways:

- **Build-Time (GitHub Actions / Environment)**:
  Add `VITE_AI_PROXY_URL` to your environment or GitHub Repository Secrets:
  ```bash
  VITE_AI_PROXY_URL=https://money-manager-gemini-proxy.<your-subdomain>.workers.dev
  ```

- **Runtime (Browser)**:
  In the browser developer console:
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
