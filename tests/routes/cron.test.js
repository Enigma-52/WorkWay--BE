import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../src/dao/usersDao.js', () => ({
  usersDao: { getById: vi.fn() },
}));
vi.mock('../../src/dao/dao.js', () => ({
  defaultPgDao: { getQ: vi.fn(), getAllRows: vi.fn() },
  runPgStatement: vi.fn(),
}));
vi.mock('../../src/services/cronRunner.js', () => ({
  runCronJob: vi.fn(),
}));
vi.mock('../../src/services/cronScheduler.js', () => ({
  JOBS: [{ tag: 'daily_greenhouse', fn: vi.fn(), schedule: '0 0,4,8,12,16,20 * * *' }],
  getNextRunTime: vi.fn().mockReturnValue(null),
}));
// The legacy ingestion-trigger routes at the top of cron.js pull in the real
// scraping services — stub them so importing the router doesn't drag in
// unrelated network-calling code.
vi.mock('../../src/services/cronService.js', () => ({
  fetchGreenhouseJobs: vi.fn(),
  insertGreenhouseCompanies: vi.fn(),
  insertYCcompanies: vi.fn(),
  insertLeverCompanies: vi.fn(),
  fetchLeverJobs: vi.fn(),
  insertAshbyCompanies: vi.fn(),
  fetchAshbyJobs: vi.fn(),
  insertWorkableCompanies: vi.fn(),
}));
vi.mock('../../src/services/backfillService.js', () => ({ backfillSkillsFromStoredDescriptions: vi.fn() }));
vi.mock('../../src/services/dailyService.js', () => ({
  insertGreenhouseJobsDaily: vi.fn(),
  insertWorkableJobsDaily: vi.fn(),
  insertYCJobsDaily: vi.fn(),
}));

const { usersDao } = await import('../../src/dao/usersDao.js');
const { defaultPgDao, runPgStatement } = await import('../../src/dao/dao.js');
const { runCronJob } = await import('../../src/services/cronRunner.js');
const cronRoutes = (await import('../../src/routes/cron.js')).default;

const app = express();
app.use(express.json());
app.use('/api/cron', cronRoutes);

const ADMIN = { id: 'admin-1', roles: ['admin'] };
const NON_ADMIN = { id: 'user-1', roles: ['seeker'] };

beforeEach(() => {
  vi.clearAllMocks();
  defaultPgDao.getQ.mockResolvedValue([]);
  defaultPgDao.getAllRows.mockResolvedValue([]);
  runPgStatement.mockResolvedValue([]);
});

describe('cron admin routes — requireAdmin gate', () => {
  const endpoints = [
    ['get', '/api/cron/status'],
    ['get', '/api/cron/runs'],
    ['get', '/api/cron/config'],
    ['get', '/api/cron/run/daily_greenhouse'],
    ['get', '/api/cron/toggle/daily_greenhouse'],
  ];

  it.each(endpoints)('%s %s 400s without a user_id', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(400);
  });

  it.each(endpoints)('%s %s 403s for a real but non-admin user', async (method, url) => {
    usersDao.getById.mockResolvedValue(NON_ADMIN);
    const res = await request(app)[method](`${url}${url.includes('?') ? '&' : '?'}user_id=user-1`);
    expect(res.status).toBe(403);
  });

  it.each(endpoints)('%s %s 403s for an unknown user_id', async (method, url) => {
    usersDao.getById.mockResolvedValue(null);
    const res = await request(app)[method](`${url}${url.includes('?') ? '&' : '?'}user_id=ghost`);
    expect(res.status).toBe(403);
  });

  it.each(endpoints)('%s %s succeeds for a real admin', async (method, url) => {
    usersDao.getById.mockResolvedValue(ADMIN);
    runCronJob.mockResolvedValue({ status: 'completed' });
    const res = await request(app)[method](`${url}${url.includes('?') ? '&' : '?'}user_id=admin-1`);
    expect(res.status).toBeLessThan(300);
  });
});

describe('GET /api/cron/run/:tag', () => {
  it('404s for a tag that is not registered', async () => {
    usersDao.getById.mockResolvedValue(ADMIN);
    const res = await request(app).get('/api/cron/run/not_a_real_job?user_id=admin-1');
    expect(res.status).toBe(404);
    expect(runCronJob).not.toHaveBeenCalled();
  });

  it('triggers the real job function for a registered tag', async () => {
    usersDao.getById.mockResolvedValue(ADMIN);
    runCronJob.mockResolvedValue({ status: 'completed', runId: 1 });
    const res = await request(app).get('/api/cron/run/daily_greenhouse?user_id=admin-1');
    expect(res.status).toBe(200);
    expect(runCronJob).toHaveBeenCalledWith(expect.objectContaining({ tag: 'daily_greenhouse' }));
  });
});

describe('GET /api/cron/toggle/:tag', () => {
  it('404s for a tag that is not registered (audit fix: whitelist, not free-text)', async () => {
    usersDao.getById.mockResolvedValue(ADMIN);
    const res = await request(app).get('/api/cron/toggle/some_typo_d_tag?user_id=admin-1');
    expect(res.status).toBe(404);
    expect(defaultPgDao.getQ).not.toHaveBeenCalledWith(
      expect.objectContaining({ sql: expect.stringContaining('INSERT INTO cron_config') })
    );
  });

  it('upserts cron_config for a registered tag', async () => {
    usersDao.getById.mockResolvedValue(ADMIN);
    const res = await request(app).get('/api/cron/toggle/daily_greenhouse?enabled=false&user_id=admin-1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tag: 'daily_greenhouse', enabled: false });
  });
});
