import { logger } from './logger.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Cloudflare's own documented always-passing test secret — pairs with the
// test site key used on the frontend when no real Turnstile credentials are
// configured, so local dev works without real Cloudflare setup. Never rely
// on this in production; set TURNSTILE_SECRET_KEY.
const TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';
const SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || TEST_SECRET_KEY;

// Verifies a Turnstile token server-side — the token alone proves nothing;
// only Cloudflare's own verification endpoint can confirm it's real,
// unexpired, and unused. Always fails closed: any network/parse error is
// treated as a failed challenge, never silently allowed through.
export async function verifyTurnstileToken(token, remoteIp) {
  if (!token || typeof token !== 'string') return false;

  try {
    const body = new URLSearchParams({ secret: SECRET_KEY, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    logger.error('Turnstile verification request failed', { error: err.message });
    return false;
  }
}
