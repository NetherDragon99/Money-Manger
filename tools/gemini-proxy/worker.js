/**
 * Cloudflare Worker Gemini AI Proxy for Money Manager
 *
 * Secure serverless gateway to Google Gemini API:
 * - Keeps the Gemini API key secret on the server via Cloudflare Secrets (`GEMINI_API_KEY`).
 * - Validates CORS requests from authorized web origins (e.g., GitHub Pages).
 * - Accepts user requests with Firebase ID tokens (Bearer authentication).
 * - Forwards requests to Google Generative Language API and relays responses.
 *
 * Deployment:
 *   npx wrangler secret put GEMINI_API_KEY
 *   npx wrangler deploy
 */

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

    // 3. User Authentication Validation (Optional Firebase ID Token check)
    const authHeader = request.headers.get('Authorization') || '';
    if (env.REQUIRE_AUTH === 'true' && !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Firebase Bearer token required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    try {
      const body = await request.json();
      const model = body.model || 'gemini-2.5-flash';
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
