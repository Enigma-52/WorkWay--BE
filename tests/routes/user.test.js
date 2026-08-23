import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../src/dao/usersDao.js', () => ({
  usersDao: {
    upsertUser: vi.fn(),
    getById: vi.fn(),
    setEmailsOptedOut: vi.fn(),
    updateRoleAndName: vi.fn(),
  },
}));
vi.mock('../../src/services/lifecycleEmailService.js', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(),
}));
vi.mock('../../src/utils/unsubscribeToken.js', () => ({
  verifyUnsubscribeToken: vi.fn(),
}));

const { usersDao } = await import('../../src/dao/usersDao.js');
const routes = (await import('../../src/routes/user.js')).default;

const app = express();
app.use(express.json());
app.use('/api/user', routes);

const withSecret = (req) => req.set('x-internal-api-secret', 'test-internal-secret');

beforeEach(() => vi.clearAllMocks());

describe('GET /api/user/me — internal-secret gating', () => {
  it('401s with no secret header at all', async () => {
    const res = await request(app).get('/api/user/me?user_id=u1');
    expect(res.status).toBe(401);
  });

  it('401s with a wrong secret', async () => {
    const res = await request(app).get('/api/user/me?user_id=u1').set('x-internal-api-secret', 'nope');
    expect(res.status).toBe(401);
  });

  it('400s without user_id (secret present)', async () => {
    expect((await withSecret(request(app).get('/api/user/me'))).status).toBe(400);
  });

  it('returns the caller plan/roles when the secret is present', async () => {
    usersDao.getById.mockResolvedValue({ id: 'u1', plan_key: 'pro', roles: ['seeker'], display_name: 'A' });
    const res = await withSecret(request(app).get('/api/user/me?user_id=u1'));
    expect(res.status).toBe(200);
    expect(res.body.plan_key).toBe('pro');
  });
});

describe('PATCH /api/user/me — internal-secret gating', () => {
  it('401s with no secret header at all', async () => {
    const res = await request(app).patch('/api/user/me').send({ email: 'victim@gmail.com', role: 'hirer' });
    expect(res.status).toBe(401);
  });

  it('401s with a wrong secret', async () => {
    const res = await request(app)
      .patch('/api/user/me')
      .set('x-internal-api-secret', 'nope')
      .send({ email: 'victim@gmail.com', role: 'hirer' });
    expect(res.status).toBe(401);
  });

  it('rejects a role outside the onboarding allowlist even with a valid secret', async () => {
    const res = await withSecret(request(app).patch('/api/user/me')).send({ email: 'a@gmail.com', role: 'admin' });
    expect(res.status).toBe(400);
    expect(usersDao.updateRoleAndName).not.toHaveBeenCalled();
  });

  it('updates role + display_name when the secret is present', async () => {
    usersDao.updateRoleAndName.mockResolvedValue({ email: 'a@gmail.com', role: 'seeker' });
    const res = await withSecret(request(app).patch('/api/user/me')).send({ email: 'a@gmail.com', role: 'seeker', display_name: 'A' });
    expect(res.status).toBe(200);
    expect(usersDao.updateRoleAndName).toHaveBeenCalledWith({ email: 'a@gmail.com', role: 'seeker', displayName: 'A' });
  });
});

describe('POST /api/user/sync — already gated pre-existing behavior, unaffected by this change', () => {
  it('401s with no secret', async () => {
    const res = await request(app).post('/api/user/sync').send({ email: 'a@gmail.com' });
    expect(res.status).toBe(401);
  });

  it('succeeds with the secret present', async () => {
    usersDao.upsertUser.mockResolvedValue({ id: 'u1', is_new: false });
    const res = await withSecret(request(app).post('/api/user/sync')).send({ email: 'a@gmail.com' });
    expect(res.status).toBe(200);
  });
});
