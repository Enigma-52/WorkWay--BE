import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/dao/applicationsDao.js', () => ({
  applicationsDao: {
    addApplication: vi.fn(),
    updateApplicationByUserAndSlug: vi.fn(),
    getByUser: vi.fn(),
  },
}));
vi.mock('../../../src/dao/jobsDao.js', () => ({
  jobsDao: { getSingleJob: vi.fn() },
}));

const { applicationsDao } = await import('../../../src/dao/applicationsDao.js');
const { jobsDao } = await import('../../../src/dao/jobsDao.js');
const {
  makeLogApplicationHandler,
  makeUpdateApplicationStatusHandler,
  makeListApplicationsHandler,
} = await import('../../../mcp/tools/applications.js');

const ctx = { user: { id: 7, plan_key: 'free' } };
beforeEach(() => vi.clearAllMocks());
const textOf = (r) => r.content[0].text;

describe('log_application', () => {
  it('errors when the slug matches no job', async () => {
    jobsDao.getSingleJob.mockResolvedValue([]);
    const res = await makeLogApplicationHandler(ctx)({ job_slug: 'ghost' });
    expect(res.isError).toBe(true);
    expect(applicationsDao.addApplication).not.toHaveBeenCalled();
  });

  it('logs against the authenticated user, resolving real job details rather than trusting args', async () => {
    jobsDao.getSingleJob.mockResolvedValue([{ slug: 'acme-eng', title: 'Engineer', company: 'Acme' }]);
    applicationsDao.addApplication.mockResolvedValue([{ id: 1 }]);

    await makeLogApplicationHandler(ctx)({ job_slug: 'acme-eng', user_id: 999 });
    expect(applicationsDao.addApplication).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, jobSlug: 'acme-eng', jobTitle: 'Engineer', company: 'Acme' })
    );
  });

  it('reports plainly when the job is already logged (unique-constraint no-op)', async () => {
    jobsDao.getSingleJob.mockResolvedValue([{ slug: 'acme-eng', title: 'Engineer', company: 'Acme' }]);
    applicationsDao.addApplication.mockResolvedValue([]);
    expect(textOf(await makeLogApplicationHandler(ctx)({ job_slug: 'acme-eng' }))).toMatch(/already logged/i);
  });
});

describe('update_application_status', () => {
  it('requires at least one of status or notes', async () => {
    const res = await makeUpdateApplicationStatusHandler(ctx)({ job_slug: 'acme-eng' });
    expect(res.isError).toBe(true);
    expect(applicationsDao.updateApplicationByUserAndSlug).not.toHaveBeenCalled();
  });

  it('errors when no logged application exists for that slug', async () => {
    applicationsDao.updateApplicationByUserAndSlug.mockResolvedValue(null);
    const res = await makeUpdateApplicationStatusHandler(ctx)({ job_slug: 'acme-eng', status: 'Interview' });
    expect(res.isError).toBe(true);
  });

  it('updates status and notes for the authenticated user', async () => {
    applicationsDao.updateApplicationByUserAndSlug.mockResolvedValue({ id: 1, status: 'Interview' });
    const res = await makeUpdateApplicationStatusHandler(ctx)({ job_slug: 'acme-eng', status: 'Interview', notes: 'Phone screen went well' });
    expect(res.isError).toBeUndefined();
    expect(applicationsDao.updateApplicationByUserAndSlug).toHaveBeenCalledWith({
      userId: 7, jobSlug: 'acme-eng', status: 'Interview', notes: 'Phone screen went well',
    });
  });
});

describe('list_applications', () => {
  it('lists only the authenticated user applications', async () => {
    applicationsDao.getByUser.mockResolvedValue([
      { job_slug: 'acme-eng', job_title: 'Engineer', company: 'Acme', status: 'Applied', notes: null, applied_at: '2026-01-01' },
    ]);
    const payload = JSON.parse(textOf(await makeListApplicationsHandler(ctx)()));

    expect(applicationsDao.getByUser).toHaveBeenCalledWith(7);
    expect(payload.applications[0].status).toBe('Applied');
    expect(payload.applications[0].workway_url).toBe('https://workway.dev/job/acme-eng');
  });

  it('reports an empty list plainly', async () => {
    applicationsDao.getByUser.mockResolvedValue([]);
    expect(JSON.parse(textOf(await makeListApplicationsHandler(ctx)())).count).toBe(0);
  });
});
