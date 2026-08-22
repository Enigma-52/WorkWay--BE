import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/apiKeyService.js', () => ({ verifyApiKey: vi.fn() }));

const { verifyApiKey } = await import('../../src/services/apiKeyService.js');
const { resolveApiKey } = await import('../../mcp/auth.js');

beforeEach(() => vi.clearAllMocks());

const reqWith = (auth) => ({ headers: auth ? { authorization: auth } : {} });

describe('resolveApiKey', () => {
  it('rejects a request with no Authorization header, pointing at the settings page', async () => {
    const res = await resolveApiKey(reqWith(null));
    expect(res.ok).toBe(false);
    expect(res.message).toContain('workway.dev');
    expect(verifyApiKey).not.toHaveBeenCalled();
  });

  it('rejects a non-Bearer scheme', async () => {
    expect((await resolveApiKey(reqWith('Basic abc'))).ok).toBe(false);
  });

  it('passes the bearer token to verifyApiKey', async () => {
    verifyApiKey.mockResolvedValue({ ok: true, user: { id: 7 } });
    await resolveApiKey(reqWith('Bearer wk_live_x'));
    expect(verifyApiKey).toHaveBeenCalledWith('wk_live_x');
  });

  it('surfaces an expired key distinctly from an invalid one', async () => {
    verifyApiKey.mockResolvedValue({ ok: false, reason: 'expired' });
    expect((await resolveApiKey(reqWith('Bearer wk_live_x'))).message).toMatch(/expired/i);
  });

  it('returns the user on success', async () => {
    verifyApiKey.mockResolvedValue({ ok: true, user: { id: 7, plan_key: 'pro' } });
    const res = await resolveApiKey(reqWith('Bearer wk_live_x'));
    expect(res).toEqual({ ok: true, user: { id: 7, plan_key: 'pro' } });
  });
});
