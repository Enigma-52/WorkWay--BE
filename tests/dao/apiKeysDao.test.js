import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/utils/initializers/postgres.js', () => ({
  getPgPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }),
}));

const { apiKeysDao } = await import('../../src/dao/apiKeysDao.js');

beforeEach(() => vi.clearAllMocks());

describe('apiKeysDao', () => {
  it('create passes null expires_at through when omitted', async () => {
    const spy = vi.spyOn(apiKeysDao, 'getQ').mockResolvedValue({ id: 1 });
    await apiKeysDao.create({ userId: 7, name: 'cli', keyHash: 'h', keyPrefix: 'wk_live_ab' });
    expect(spy.mock.calls[0][0].values).toEqual([7, 'cli', 'h', 'wk_live_ab', null]);
  });

  it('findByHash looks up by hash only', async () => {
    const spy = vi.spyOn(apiKeysDao, 'getQ').mockResolvedValue(null);
    await apiKeysDao.findByHash('deadbeef');
    expect(spy.mock.calls[0][0].values).toEqual(['deadbeef']);
    expect(spy.mock.calls[0][0].firstResultOnly).toBe(true);
  });

  it('revoke scopes the update to the owning user', async () => {
    const spy = vi.spyOn(apiKeysDao, 'getQ').mockResolvedValue({ id: 3 });
    await apiKeysDao.revoke({ id: 3, userId: 7 });
    expect(spy.mock.calls[0][0].values).toEqual([3, 7]);
    expect(spy.mock.calls[0][0].sql).toContain('user_id = $2');
  });

  it('touchLastUsed increments usage_count', async () => {
    const spy = vi.spyOn(apiKeysDao, 'updateQ').mockResolvedValue({});
    await apiKeysDao.touchLastUsed(3);
    expect(spy.mock.calls[0][0].sql).toContain('usage_count = usage_count + 1');
  });
});
