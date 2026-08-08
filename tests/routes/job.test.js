import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../src/services/jobService.js', () => ({
  getJobDetails: vi.fn(),
  getJobList: vi.fn(),
  getJobFilters: vi.fn(),
  getSalaryInsights: vi.fn(),
  normalizeAndValidateListParams: vi.fn(),
}));
vi.mock('../../src/services/jobViewEventsService.js', () => ({ recordJobView: vi.fn() }));
vi.mock('../../src/dao/jobsDao.js', () => ({ jobsDao: { getRow: vi.fn() } }));
vi.mock('../../src/dao/jobReportsDao.js', () => ({
  jobReportsDao: { create: vi.fn(), maybeDeactivate: vi.fn() },
}));

const { jobsDao } = await import('../../src/dao/jobsDao.js');
const { jobReportsDao } = await import('../../src/dao/jobReportsDao.js');
const jobRoutes = (await import('../../src/routes/job.js')).default;

function buildApp({ ip } = {}) {
  const app = express();
  app.use(express.json());
  if (ip) {
    app.use((req, res, next) => {
      Object.defineProperty(req, 'ip', { value: ip, configurable: true });
      next();
    });
  }
  app.use('/api/job', jobRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/job/report — validation', () => {
  it('400s without a slug', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/job/report').send({ reason: 'spam' });
    expect(res.status).toBe(400);
  });

  it('400s on an unrecognized reason', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/job/report').send({ slug: 'acme-eng', reason: 'because I said so' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason must be one of/);
  });

  it('404s for a job slug that does not exist', async () => {
    jobsDao.getRow.mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app).post('/api/job/report').send({ slug: 'ghost-job', reason: 'spam' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/job/report — reporting and dedup', () => {
  it('creates a report and does not deactivate the job below the threshold', async () => {
    jobsDao.getRow.mockResolvedValue({ id: 1, slug: 'acme-eng' });
    jobReportsDao.create.mockResolvedValue({ id: 10 });
    jobReportsDao.maybeDeactivate.mockResolvedValue(false);

    const app = buildApp({ ip: '203.0.113.5' });
    const res = await request(app).post('/api/job/report').send({ slug: 'acme-eng', reason: 'spam' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, already_reported: false });
    expect(jobReportsDao.create).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 1, reason: 'spam', reporterIp: '203.0.113.5' })
    );
  });

  it('treats a same-IP duplicate report as a no-op success, not an error', async () => {
    jobsDao.getRow.mockResolvedValue({ id: 1, slug: 'acme-eng' });
    jobReportsDao.create.mockResolvedValue(null); // unique constraint hit

    const app = buildApp({ ip: '203.0.113.5' });
    const res = await request(app).post('/api/job/report').send({ slug: 'acme-eng', reason: 'spam' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, already_reported: true });
    expect(jobReportsDao.maybeDeactivate).not.toHaveBeenCalled();
  });

  it('auto-deactivates the job once the report count crosses the threshold', async () => {
    jobsDao.getRow.mockResolvedValue({ id: 1, slug: 'acme-eng' });
    jobReportsDao.create.mockResolvedValue({ id: 12 });
    jobReportsDao.maybeDeactivate.mockResolvedValue(true);

    const app = buildApp({ ip: '203.0.113.9' });
    const res = await request(app).post('/api/job/report').send({ slug: 'acme-eng', reason: 'link_broken' });

    expect(res.status).toBe(201);
    expect(jobReportsDao.maybeDeactivate).toHaveBeenCalledWith(1);
  });

  it('truncates report details to 500 characters', async () => {
    jobsDao.getRow.mockResolvedValue({ id: 1, slug: 'acme-eng' });
    jobReportsDao.create.mockResolvedValue({ id: 1 });
    jobReportsDao.maybeDeactivate.mockResolvedValue(false);

    const longDetails = 'x'.repeat(1000);
    const app = buildApp({ ip: '203.0.113.5' });
    await request(app).post('/api/job/report').send({ slug: 'acme-eng', reason: 'other', details: longDetails });

    const call = jobReportsDao.create.mock.calls[0][0];
    expect(call.details).toHaveLength(500);
  });
});

describe('IP resolution — trust-proxy correctness', () => {
  it('strips the ::ffff: IPv4-mapped IPv6 prefix', async () => {
    jobsDao.getRow.mockResolvedValue({ id: 1, slug: 'acme-eng' });
    jobReportsDao.create.mockResolvedValue({ id: 1 });
    jobReportsDao.maybeDeactivate.mockResolvedValue(false);

    const app = buildApp({ ip: '::ffff:198.51.100.7' });
    await request(app).post('/api/job/report').send({ slug: 'acme-eng', reason: 'spam' });

    expect(jobReportsDao.create).toHaveBeenCalledWith(expect.objectContaining({ reporterIp: '198.51.100.7' }));
  });

  it('never trusts a spoofable X-Forwarded-For header directly — uses req.ip only', async () => {
    jobsDao.getRow.mockResolvedValue({ id: 1, slug: 'acme-eng' });
    jobReportsDao.create.mockResolvedValue({ id: 1 });
    jobReportsDao.maybeDeactivate.mockResolvedValue(false);

    // req.ip resolves to the real connecting peer; a forged XFF header must
    // not override it.
    const app = buildApp({ ip: '198.51.100.7' });
    await request(app)
      .post('/api/job/report')
      .set('X-Forwarded-For', '1.2.3.4')
      .send({ slug: 'acme-eng', reason: 'spam' });

    expect(jobReportsDao.create).toHaveBeenCalledWith(expect.objectContaining({ reporterIp: '198.51.100.7' }));
  });

  it('falls back to null for a malformed/non-IP req.ip rather than throwing', async () => {
    jobsDao.getRow.mockResolvedValue({ id: 1, slug: 'acme-eng' });
    jobReportsDao.create.mockResolvedValue({ id: 1 });
    jobReportsDao.maybeDeactivate.mockResolvedValue(false);

    const app = buildApp({ ip: 'not-an-ip' });
    const res = await request(app).post('/api/job/report').send({ slug: 'acme-eng', reason: 'spam' });

    expect(res.status).toBe(201);
    expect(jobReportsDao.create).toHaveBeenCalledWith(expect.objectContaining({ reporterIp: null }));
  });
});

describe('POST /api/job/report — rate limiting', () => {
  it('allows 10 requests in the window and rejects the 11th with 429', async () => {
    jobsDao.getRow.mockResolvedValue({ id: 1, slug: 'acme-eng' });
    jobReportsDao.create.mockResolvedValue({ id: 1 });
    jobReportsDao.maybeDeactivate.mockResolvedValue(false);

    const app = buildApp({ ip: '203.0.113.20' });
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/api/job/report').send({ slug: 'acme-eng', reason: 'spam' });
      expect(res.status).toBeLessThan(300);
    }
    const eleventh = await request(app).post('/api/job/report').send({ slug: 'acme-eng', reason: 'spam' });
    expect(eleventh.status).toBe(429);
  });
});
