import crypto from 'crypto';
import { apiKeysDao } from '../dao/apiKeysDao.js';

export const KEY_PREFIX = 'wk_live_';
const PREFIX_DISPLAY_LEN = KEY_PREFIX.length + 6;

// Same one-way scheme as magic links (see magicLinkService.js): the raw key is
// shown to the user exactly once and only its sha256 is persisted, so a DB leak
// never yields usable credentials.
function hash(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function generateApiKey({ userId, name, expiresInDays = null }) {
  const raw = KEY_PREFIX + crypto.randomBytes(24).toString('hex');
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000)
    : null;

  const key = await apiKeysDao.create({
    userId,
    name: name || 'Untitled key',
    keyHash: hash(raw),
    keyPrefix: raw.slice(0, PREFIX_DISPLAY_LEN),
    expiresAt,
  });

  return { raw, key };
}

export async function verifyApiKey(rawKey) {
  if (typeof rawKey !== 'string' || !rawKey.startsWith(KEY_PREFIX)) {
    return { ok: false, reason: 'invalid' };
  }

  const row = await apiKeysDao.findByHash(hash(rawKey));
  if (!row) return { ok: false, reason: 'invalid' };
  if (row.revoked_at) return { ok: false, reason: 'revoked' };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  // Fire-and-forget: usage tracking must never fail or slow down a tool call.
  apiKeysDao.touchLastUsed(row.id);

  return {
    ok: true,
    keyId: row.id,
    user: { id: row.owner_id ?? row.user_id, email: row.email, plan_key: row.plan_key },
  };
}

export async function listApiKeys(userId) {
  return apiKeysDao.listByUser(userId);
}

export async function revokeApiKey({ id, userId }) {
  const row = await apiKeysDao.revoke({ id, userId });
  return !!row;
}
