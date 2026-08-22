import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

vi.mock('../../src/dao/apiKeysDao.js', () => ({
  apiKeysDao: {
    create: vi.fn(), findByHash: vi.fn(), listByUser: vi.fn(),
    revoke: vi.fn(), touchLastUsed: vi.fn(),
  },
}));

const { apiKeysDao } = await import('../../src/dao/apiKeysDao.js');
const { generateApiKey, verifyApiKey, revokeApiKey, KEY_PREFIX } =
  await import('../../src/services/apiKeyService.js');

beforeEach(() => vi.clearAllMocks());

const hashOf = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

describe('generateApiKey', () => {
  it('returns a prefixed raw key and stores only its hash', async () => {
    apiKeysDao.create.mockResolvedValue({ id: 1, name: 'cli', key_prefix: 'x' });
    const { raw } = await generateApiKey({ userId: 7, name: 'cli' });

    expect(raw.startsWith(KEY_PREFIX)).toBe(true);
    const stored = apiKeysDao.create.mock.calls[0][0];
    expect(stored.keyHash).toBe(hashOf(raw));
    expect(stored.keyHash).not.toContain(raw);
  });

  it('converts expiresInDays into an absolute expires_at', async () => {
    apiKeysDao.create.mockResolvedValue({ id: 1 });
    await generateApiKey({ userId: 7, name: 'cli', expiresInDays: 30 });
    const { expiresAt } = apiKeysDao.create.mock.calls[0][0];
    const days = (expiresAt.getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it('defaults to a never-expiring key', async () => {
    apiKeysDao.create.mockResolvedValue({ id: 1 });
    await generateApiKey({ userId: 7, name: 'cli' });
    expect(apiKeysDao.create.mock.calls[0][0].expiresAt).toBeNull();
  });
});

describe('verifyApiKey', () => {
  it('rejects an unknown key', async () => {
    apiKeysDao.findByHash.mockResolvedValue(null);
    expect(await verifyApiKey('wk_live_nope')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a revoked key', async () => {
    apiKeysDao.findByHash.mockResolvedValue({ id: 1, revoked_at: new Date(), user_id: 7 });
    expect((await verifyApiKey('wk_live_x')).reason).toBe('revoked');
  });

  it('rejects an expired key', async () => {
    apiKeysDao.findByHash.mockResolvedValue({
      id: 1, revoked_at: null, expires_at: new Date(Date.now() - 1000), user_id: 7,
    });
    expect((await verifyApiKey('wk_live_x')).reason).toBe('expired');
  });

  it('accepts a valid key, returns the owner, and records usage', async () => {
    apiKeysDao.findByHash.mockResolvedValue({
      id: 1, revoked_at: null, expires_at: null,
      user_id: 7, owner_id: 7, email: 'a@b.co', plan_key: 'pro',
    });
    const result = await verifyApiKey('wk_live_x');

    expect(result.ok).toBe(true);
    expect(result.user).toEqual({ id: 7, email: 'a@b.co', plan_key: 'pro' });
    expect(apiKeysDao.touchLastUsed).toHaveBeenCalledWith(1);
  });

  it('never records usage for a rejected key', async () => {
    apiKeysDao.findByHash.mockResolvedValue(null);
    await verifyApiKey('wk_live_x');
    expect(apiKeysDao.touchLastUsed).not.toHaveBeenCalled();
  });
});

describe('revokeApiKey', () => {
  it('reports false when nothing was revoked', async () => {
    apiKeysDao.revoke.mockResolvedValue(null);
    expect(await revokeApiKey({ id: 1, userId: 7 })).toBe(false);
  });
});
