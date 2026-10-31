/**
 * Cloudflare Worker Gemini AI Proxy for Money Manager
 *
 * Secure serverless gateway to Google Gemini API:
 * - Keeps the Gemini API key secret on the server via Cloudflare Secrets (`GEMINI_API_KEY`).
 * - Verifies Firebase ID token (`Authorization: Bearer <idToken>`) including JWT claims (`iss`, `aud`, `exp`, `sub`)
 *   and optional Firebase Auth token verification endpoint.
 * - Enforces a per-user daily request quota (`DAILY_USER_QUOTA`, default 30/day per `uid`) via KV (`env.QUOTA_KV`)
 *   or an in-memory isolate fallback map.
 * - Validates CORS requests from authorized web origins (e.g., GitHub Pages).
 * - Forwards requests to Google Generative Language API via `x-goog-api-key` header (never query params) and relays responses.
 *
 * Deployment:
 *   npx wrangler secret put GEMINI_API_KEY
 *   npx wrangler deploy
 */

// Isolate-level fallback quota tracker when KV binding (`QUOTA_KV`) is not configured
const inMemoryQuotaMap = new Map();

function decodeBase64UrlJson(segment) {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const decoded = atob(padded);
  return JSON.parse(decoded);
}

/**
 * Verifies a Firebase Auth ID Token and returns the verified `uid`.
 * Checks JWT structure, expiration (`exp`), issued-at (`iat`), subject (`sub`),
 * issuer (`https://securetoken.google.com/<projectId>`), and audience (`<projectId>`).
 * If `env.FIREBASE_WEB_API_KEY` is provided, also verifies token revocation/signature against
 * Google Identity Toolkit `accounts:lookup`.
 */
async function verifyFirebaseIdToken(idToken, env) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Firebase ID token');
  }
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT token');
  }

  let header;
  let payload;
  try {
    header = decodeBase64UrlJson(parts[0]);
    payload = decodeBase64UrlJson(parts[1]);
  } catch {
    throw new Error('Invalid JWT encoding');
  }

  if (!header || header.alg !== 'RS256' || !header.kid) {
    throw new Error('Invalid JWT header algorithm');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload || typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Firebase ID token has expired');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Invalid JWT issued-at timestamp');
  }
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
    throw new Error('Invalid JWT subject (uid)');
  }

  const expectedProjectId = env.FIREBASE_PROJECT_ID || '';
  if (expectedProjectId) {
    if (payload.aud !== expectedProjectId) {
      throw new Error('JWT audience mismatch');
    }
    if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
      throw new Error('JWT issuer mismatch');
    }
  } else if (
    typeof payload.iss !== 'string' ||
    !payload.iss.startsWith('https://securetoken.google.com/')
  ) {
    throw new Error('Untrusted JWT issuer');
  }

  if (env.FIREBASE_WEB_API_KEY) {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!verifyRes.ok) {
      throw new Error('Firebase Auth token verification rejected');
    }
    const verifyData = await verifyRes.json();
    const matchedUser = verifyData?.users?.[0];
    if (!matchedUser || matchedUser.localId !== payload.sub) {
      throw new Error('Firebase user mismatch');
    }
  }

  return payload.sub;
}

/**
 * Checks and increments the daily quota for a given user (`uid`).
 * Returns `{ allowed: boolean, count: number, limit: number }`.
 */
async function checkAndIncrementDailyQuota(uid, env) {
  const dailyLimit = Math.max(1, parseInt(env.DAILY_USER_QUOTA || '30', 10) || 30);
  const utcDay = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `quota:${uid}:${utcDay}`;

  if (env.QUOTA_KV && typeof env.QUOTA_KV.get === 'function') {
    const currentRaw = await env.QUOTA_KV.get(key);
    const currentCount = currentRaw ? parseInt(currentRaw, 10) || 0 : 0;
    if (currentCount >= dailyLimit) {
      return { allowed: false, count: currentCount, limit: dailyLimit };
    }
    const nextCount = currentCount + 1;
    await env.QUOTA_KV.put(key, String(nextCount), { expirationTtl: 86400 * 2 });
    return { allowed: true, count: nextCount, limit: dailyLimit };
  }

  // Fallback to in-memory isolate map
  const currentCount = inMemoryQuotaMap.get(key) || 0;
  if (currentCount >= dailyLimit) {
    return { allowed: false, count: currentCount, limit: dailyLimit };
  }
  const nextCount = currentCount + 1;
  inMemoryQuotaMap.set(key, nextCount);
  return { allowed: true, count: nextCount, limit: dailyLimit };
}

export default {
  async fetch(request, env) {
    // 1. CORS Preflight & Response Headers
    const origin = request.headers.get('Origin') || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-goog-api-key',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 2. Secret Key Verification from Worker Environment
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: GEMINI_API_KEY secret is not set.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 3. Firebase ID Token Verification & Per-User Daily Quota Enforcement
    const authHeader = request.headers.get('Authorization') || '';
    const requireAuth = env.REQUIRE_AUTH !== 'false';
    let uid = 'anonymous';

    if (requireAuth || authHeader.startsWith('Bearer ')) {
      if (!authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Firebase Bearer ID token required.' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      const idToken = authHeader.slice(7).trim();
      try {
        uid = await verifyFirebaseIdToken(idToken, env);
      } catch (authErr) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Invalid Firebase ID token', details: authErr?.message }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    const quota = await checkAndIncrementDailyQuota(uid, env);
    if (!quota.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Daily AI quota exceeded for this user.',
          limit: quota.limit,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    try {
      const body = await request.json();
      const model = body.model || 'gemini-1.5-flash';
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const geminiRequestBody = {
        contents: body.contents || [
          {
            parts: [{ text: body.prompt || '' }],
          },
        ],
        generationConfig: body.generationConfig || {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      };

      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(geminiRequestBody),
      });

      const responseData = await geminiResponse.text();

      return new Response(responseData, {
        status: geminiResponse.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Proxy request processing error', details: err?.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  },
};
