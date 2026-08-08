import crypto from 'crypto';

// Never fall back to a hardcoded string — that would let anyone forge a
// valid unsubscribe token for any user_id. A random per-boot secret means
// previously-sent links stop working across a restart if the env var truly
// isn't set, which is a much safer failure mode than a guessable constant.
const SECRET = process.env.EMAIL_UNSUB_SECRET || process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export function generateUnsubscribeToken(userId) {
  return crypto.createHmac('sha256', SECRET).update(String(userId)).digest('hex');
}

export function verifyUnsubscribeToken(userId, token) {
  const expected = generateUnsubscribeToken(userId);
  if (!token || token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
