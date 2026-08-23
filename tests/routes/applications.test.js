import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../src/dao/applicationsDao.js', () => ({
  applicationsDao: {
    addApplication: vi.fn(),
    updateApplication: vi.fn(),
    countByUser: vi.fn(),
    getByUser: vi.fn(),
  },
}));

const { applicationsDao } = await import('../../src/dao/applicationsDao.js');
const routes = (await import('../../src/routes/applications.js')).default;

const app = express();
app.use(express.json());
app.use('/api/applications', routes);

// Every request in this suite besides the gating tests must carry this —
// the router requires it (see tests/setup.js: INTERNAL_API_SECRET).
const withSecret = (req) => req.set('x-internal-api-secret', 'test-internal-secret');

beforeEach(() => vi.clearAllMocks());

describe('internal-secret gating', () => {
  it('401s with no secret header at all', async () => {
    const res = await request(app).get('/api/applications?user_id=u1');
    expect(res.status).toBe(401);
  });

  it('401s with a wrong secret', async () => {
    const res = await request(app).get('/api/applications?user_id=u1').set('x-internal-api-secret', 'nope');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/applications', () => {
  it('400s without user_id or job_slug', async () => {
    expect((await withSecret(request(app).post('/api/applications')).send({})).status).toBe(400);
  });

  it('creates an application and returns 201', async () => {
    applicationsDao.addApplication.mockResolvedValue([{ id: 1, user_id: 'u1', job_slug: 'acme-eng' }]);
    const res = await withSecret(request(app).post('/api/applications')).send({ user_id: 'u1', job_slug: 'acme-eng' });
    expect(res.status).toBe(201);
    expect(res.body.application.id).toBe(1);
  });
});

describe('PATCH /api/applications/:id', () => {
  it('400s without user_id', async () => {
    expect((await withSecret(request(app).patch('/api/applications/1')).send({ status: 'applied' })).status).toBe(400);
  });

  it('updates an owned application', async () => {
    applicationsDao.updateApplication.mockResolvedValue({ id: 1, status: 'interviewing' });
    const res = await withSecret(request(app).patch('/api/applications/1')).send({ user_id: 'u1', status: 'interviewing' });
    expect(res.status).toBe(200);
    expect(applicationsDao.updateApplication).toHaveBeenCalledWith({ id: '1', userId: 'u1', status: 'interviewing', notes: undefined });
  });
});

describe('GET /api/applications/summary', () => {
  it('400s without user_id', async () => {
    expect((await withSecret(request(app).get('/api/applications/summary'))).status).toBe(400);
  });

  it('returns the applied count', async () => {
    applicationsDao.countByUser.mockResolvedValue({ count: 3 });
    const res = await withSecret(request(app).get('/api/applications/summary?user_id=u1'));
    expect(res.body).toEqual({ count: 3 });
  });
});

describe('GET /api/applications', () => {
  it('400s without user_id', async () => {
    expect((await withSecret(request(app).get('/api/applications'))).status).toBe(400);
  });

  it('lists a user’s applications', async () => {
    applicationsDao.getByUser.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const res = await withSecret(request(app).get('/api/applications?user_id=u1'));
    expect(res.body.applications).toHaveLength(2);
  });
});
