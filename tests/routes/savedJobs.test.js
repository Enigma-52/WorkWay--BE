import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../src/dao/savedJobsDao.js', () => ({
  savedJobsDao: {
    saveJob: vi.fn(),
    unsaveJob: vi.fn(),
    getByUser: vi.fn(),
    countByUser: vi.fn(),
  },
}));

const { savedJobsDao } = await import('../../src/dao/savedJobsDao.js');
const routes = (await import('../../src/routes/savedJobs.js')).default;

const app = express();
app.use(express.json());
app.use('/api/saved-jobs', routes);

// Every request in this suite besides the gating tests must carry this —
// the router requires it (see tests/setup.js: INTERNAL_API_SECRET).
const withSecret = (req) => req.set('x-internal-api-secret', 'test-internal-secret');

beforeEach(() => vi.clearAllMocks());

describe('internal-secret gating', () => {
  it('401s with no secret header at all', async () => {
    const res = await request(app).get('/api/saved-jobs?user_id=u1');
    expect(res.status).toBe(401);
  });

  it('401s with a wrong secret', async () => {
    const res = await request(app).get('/api/saved-jobs?user_id=u1').set('x-internal-api-secret', 'nope');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/saved-jobs/summary', () => {
  it('400s without user_id', async () => {
    expect((await withSecret(request(app).get('/api/saved-jobs/summary'))).status).toBe(400);
  });

  it('returns the saved count', async () => {
    savedJobsDao.countByUser.mockResolvedValue({ count: 4 });
    const res = await withSecret(request(app).get('/api/saved-jobs/summary?user_id=u1'));
    expect(res.body).toEqual({ count: 4 });
  });
});

describe('GET /api/saved-jobs', () => {
  it('400s without user_id', async () => {
    expect((await withSecret(request(app).get('/api/saved-jobs'))).status).toBe(400);
  });

  it('lists a user’s saved jobs', async () => {
    savedJobsDao.getByUser.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const res = await withSecret(request(app).get('/api/saved-jobs?user_id=u1'));
    expect(res.body.saved_jobs).toHaveLength(2);
  });
});

describe('POST /api/saved-jobs', () => {
  it('400s without user_id or job_slug', async () => {
    expect((await withSecret(request(app).post('/api/saved-jobs')).send({})).status).toBe(400);
  });

  it('saves a job and returns 201', async () => {
    savedJobsDao.saveJob.mockResolvedValue([{ id: 1, user_id: 'u1', job_slug: 'acme-eng' }]);
    const res = await withSecret(request(app).post('/api/saved-jobs')).send({ user_id: 'u1', job_slug: 'acme-eng' });
    expect(res.status).toBe(201);
    expect(res.body.saved.id).toBe(1);
  });
});

describe('DELETE /api/saved-jobs/:slug', () => {
  it('400s without user_id', async () => {
    expect((await withSecret(request(app).delete('/api/saved-jobs/acme-eng'))).status).toBe(400);
  });

  it('unsaves an owned job', async () => {
    savedJobsDao.unsaveJob.mockResolvedValue({ id: 1 });
    const res = await withSecret(request(app).delete('/api/saved-jobs/acme-eng?user_id=u1'));
    expect(res.status).toBe(200);
    expect(savedJobsDao.unsaveJob).toHaveBeenCalledWith({ userId: 'u1', jobSlug: 'acme-eng' });
  });
});
