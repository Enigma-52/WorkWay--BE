import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../src/dao/alertsDao.js', () => ({
  alertsDao: { checkAlert: vi.fn(), getByUser: vi.fn(), createAlert: vi.fn(), deleteAlert: vi.fn() },
}));
vi.mock('../../src/dao/emailLogDao.js', () => ({
  emailLogDao: { getCompanyAlertJobsForUser: vi.fn() },
}));
vi.mock('../../src/dao/usersDao.js', () => ({
  usersDao: { getById: vi.fn() },
}));

const { alertsDao } = await import('../../src/dao/alertsDao.js');
const { emailLogDao } = await import('../../src/dao/emailLogDao.js');
const { usersDao } = await import('../../src/dao/usersDao.js');
const alertsRoutes = (await import('../../src/routes/alerts.js')).default;

const app = express();
app.use(express.json());
app.use('/api/alerts', alertsRoutes);

// Every request in this suite besides the gating tests must carry this —
// the router requires it (see tests/setup.js: INTERNAL_API_SECRET).
const withSecret = (req) => req.set('x-internal-api-secret', 'test-internal-secret');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('internal-secret gating', () => {
  it('401s with no secret header at all', async () => {
    const res = await request(app).get('/api/alerts?user_id=u1');
    expect(res.status).toBe(401);
  });

  it('401s with a wrong secret', async () => {
    const res = await request(app).get('/api/alerts?user_id=u1').set('x-internal-api-secret', 'nope');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/alerts/recent — Pro gating', () => {
  it('400s without a user_id', async () => {
    const res = await withSecret(request(app).get('/api/alerts/recent'));
    expect(res.status).toBe(400);
  });

  it('404s for an unknown user_id', async () => {
    usersDao.getById.mockResolvedValue(null);
    const res = await withSecret(request(app).get('/api/alerts/recent?user_id=ghost'));
    expect(res.status).toBe(404);
  });

  it('never queries job data for a free-plan user — returns {pro:false} only', async () => {
    usersDao.getById.mockResolvedValue({ id: 'u1', plan_key: 'free' });
    const res = await withSecret(request(app).get('/api/alerts/recent?user_id=u1'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pro: false });
    expect(emailLogDao.getCompanyAlertJobsForUser).not.toHaveBeenCalled();
  });

  it('returns the real job feed for a Pro user', async () => {
    usersDao.getById.mockResolvedValue({ id: 'u1', plan_key: 'pro' });
    emailLogDao.getCompanyAlertJobsForUser.mockResolvedValue([
      { slug: 'acme-eng', title: 'Engineer', company_name: 'Acme' },
    ]);

    const res = await withSecret(request(app).get('/api/alerts/recent?user_id=u1'));

    expect(res.status).toBe(200);
    expect(res.body.pro).toBe(true);
    expect(res.body.jobs).toHaveLength(1);
  });

  it('treats a lifetime plan the same as pro', async () => {
    usersDao.getById.mockResolvedValue({ id: 'u1', plan_key: 'lifetime' });
    emailLogDao.getCompanyAlertJobsForUser.mockResolvedValue([]);
    const res = await withSecret(request(app).get('/api/alerts/recent?user_id=u1'));
    expect(res.body.pro).toBe(true);
  });

  it('500s (without crashing the process) on a DAO error', async () => {
    // NOTE: this route returns `err.message` verbatim in the response body,
    // same as effectively every other route in this codebase — a real,
    // pre-existing, app-wide minor info-disclosure pattern, not something
    // introduced by the alerts feature. Fixing it here alone would be
    // inconsistent; it belongs in a dedicated pass across all routes.
    // This test documents current behavior, not endorses it.
    usersDao.getById.mockRejectedValue(new Error('pool exhausted'));
    const res = await withSecret(request(app).get('/api/alerts/recent?user_id=u1'));
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('pool exhausted');
  });
});

describe('POST/DELETE /api/alerts — follow/unfollow', () => {
  it('400s without a user_id on follow', async () => {
    const res = await withSecret(request(app).post('/api/alerts')).send({ company_slug: 'acme' });
    expect(res.status).toBe(400);
  });

  it('creates a follow and returns 201', async () => {
    alertsDao.createAlert.mockResolvedValue({ id: 1, company_slug: 'acme' });
    const res = await withSecret(request(app).post('/api/alerts')).send({ user_id: 'u1', company_slug: 'acme', company_name: 'Acme' });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
  });

  it('treats an existing follow (unique-constraint no-op) as success, not an error', async () => {
    alertsDao.createAlert.mockResolvedValue(null);
    const res = await withSecret(request(app).post('/api/alerts')).send({ user_id: 'u1', company_slug: 'acme' });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);
  });

  it('404s deleting an alert that does not belong to this user', async () => {
    alertsDao.deleteAlert.mockResolvedValue(null);
    const res = await withSecret(request(app).delete('/api/alerts/999?user_id=u1'));
    expect(res.status).toBe(404);
  });

  it('deletes an owned alert successfully', async () => {
    alertsDao.deleteAlert.mockResolvedValue({ id: 1 });
    const res = await withSecret(request(app).delete('/api/alerts/1?user_id=u1'));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/alerts — check + list', () => {
  it('check=1 reports whether a follow exists', async () => {
    alertsDao.checkAlert.mockResolvedValue({ id: 5 });
    const res = await withSecret(request(app).get('/api/alerts?user_id=u1&check=1&alert_type=company&company_slug=acme'));
    expect(res.body).toEqual({ exists: true, alert: { id: 5 } });
  });

  it('reports exists:false when no follow row is found', async () => {
    alertsDao.checkAlert.mockResolvedValue(null);
    const res = await withSecret(request(app).get('/api/alerts?user_id=u1&check=1&company_slug=acme'));
    expect(res.body).toEqual({ exists: false, alert: null });
  });

  it('lists all of a user’s alerts without the check flag', async () => {
    alertsDao.getByUser.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const res = await withSecret(request(app).get('/api/alerts?user_id=u1'));
    expect(res.body.alerts).toHaveLength(2);
  });
});
