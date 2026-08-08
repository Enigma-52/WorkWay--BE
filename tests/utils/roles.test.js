import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/dao/usersDao.js', () => ({
  usersDao: { getById: vi.fn() },
}));

const { usersDao } = await import('../../src/dao/usersDao.js');
const { hasAdminRole, requireAdmin } = await import('../../src/utils/roles.js');

describe('hasAdminRole', () => {
  it('recognizes the array shape', () => {
    expect(hasAdminRole(['seeker', 'admin'])).toBe(true);
    expect(hasAdminRole(['seeker'])).toBe(false);
    expect(hasAdminRole([])).toBe(false);
  });

  it('recognizes the legacy object shape', () => {
    expect(hasAdminRole({ admin: true })).toBe(true);
    expect(hasAdminRole({ admin: false })).toBe(false);
    expect(hasAdminRole({ job_seeker: true })).toBe(false);
  });

  it('is false for null/undefined/garbage', () => {
    expect(hasAdminRole(null)).toBe(false);
    expect(hasAdminRole(undefined)).toBe(false);
    expect(hasAdminRole('admin')).toBe(false);
  });
});

describe('requireAdmin middleware', () => {
  function mockReqRes({ query = {}, body = {} } = {}) {
    const req = { query, body };
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    return { req, res };
  }

  beforeEach(() => {
    usersDao.getById.mockReset();
  });

  it('400s when no user_id is present in query or body', async () => {
    const { req, res } = mockReqRes();
    const next = vi.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('403s when the user does not exist', async () => {
    usersDao.getById.mockResolvedValue(null);
    const { req, res } = mockReqRes({ query: { user_id: 'ghost' } });
    const next = vi.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('403s when the user exists but is not an admin', async () => {
    usersDao.getById.mockResolvedValue({ id: 'u1', roles: ['seeker'] });
    const { req, res } = mockReqRes({ query: { user_id: 'u1' } });
    const next = vi.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and attaches req.adminUser for a real admin', async () => {
    const admin = { id: 'admin-1', roles: ['seeker', 'admin'] };
    usersDao.getById.mockResolvedValue(admin);
    const { req, res } = mockReqRes({ query: { user_id: 'admin-1' } });
    const next = vi.fn();
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.adminUser).toEqual(admin);
    expect(res.body).toBeNull();
  });

  it('reads user_id from the body when not present in the query (POST-style calls)', async () => {
    const admin = { id: 'admin-1', roles: ['admin'] };
    usersDao.getById.mockResolvedValue(admin);
    const { req, res } = mockReqRes({ body: { user_id: 'admin-1' } });
    const next = vi.fn();
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('500s if the DAO throws, without leaking the raw error to the response', async () => {
    usersDao.getById.mockRejectedValue(new Error('connection refused: secret-internal-detail'));
    const { req, res } = mockReqRes({ query: { user_id: 'u1' } });
    const next = vi.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret-internal-detail');
  });
});
