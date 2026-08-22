import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/dao/savedJobsDao.js', () => ({
  savedJobsDao: { saveJob: vi.fn(), getByUser: vi.fn() },
}));
vi.mock('../../../src/dao/jobsDao.js', () => ({
  jobsDao: { getSingleJob: vi.fn() },
}));

const { savedJobsDao } = await import('../../../src/dao/savedJobsDao.js');
const { jobsDao } = await import('../../../src/dao/jobsDao.js');
const { makeSaveJobHandler, makeListSavedJobsHandler } = await import('../../../mcp/tools/savedJobs.js');

const ctx = { user: { id: 7, plan_key: 'free' } };
beforeEach(() => vi.clearAllMocks());
const textOf = (r) => r.content[0].text;

describe('save_job', () => {
  it('errors when the slug matches no job', async () => {
    jobsDao.getSingleJob.mockResolvedValue([]);
    const res = await makeSaveJobHandler(ctx)({ job_slug: 'ghost' });
    expect(res.isError).toBe(true);
    expect(savedJobsDao.saveJob).not.toHaveBeenCalled();
  });

  it('saves against the authenticated user, never an argument-supplied id', async () => {
    jobsDao.getSingleJob.mockResolvedValue([{ slug: 'acme-eng', title: 'Engineer', company: 'Acme', url: 'https://ats.example/1' }]);
    savedJobsDao.saveJob.mockResolvedValue([{ id: 1 }]);

    await makeSaveJobHandler(ctx)({ job_slug: 'acme-eng', user_id: 999 });
    expect(savedJobsDao.saveJob).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, jobSlug: 'acme-eng' }));
  });

  it('confirms with a link back to the dashboard', async () => {
    jobsDao.getSingleJob.mockResolvedValue([{ slug: 'acme-eng', title: 'Engineer', company: 'Acme' }]);
    savedJobsDao.saveJob.mockResolvedValue([{ id: 1 }]);
    expect(textOf(await makeSaveJobHandler(ctx)({ job_slug: 'acme-eng' }))).toContain('workway.dev/dashboard');
  });
});

describe('list_saved_jobs', () => {
  it('lists only the authenticated user saved jobs', async () => {
    // saved_jobs timestamps its rows as saved_at, not created_at.
    savedJobsDao.getByUser.mockResolvedValue([
      { job_slug: 'acme-eng', job_title: 'Engineer', company: 'Acme', job_url: 'https://ats.example/1', saved_at: '2026-01-01' },
    ]);
    const payload = JSON.parse(textOf(await makeListSavedJobsHandler(ctx)()));

    expect(savedJobsDao.getByUser).toHaveBeenCalledWith(7);
    expect(payload.saved_jobs[0].workway_url).toBe('https://workway.dev/job/acme-eng');
    expect(payload.saved_jobs[0].apply_url).toBe('https://ats.example/1');
    expect(payload.saved_jobs[0].saved_at).toBe('2026-01-01');
  });

  it('reports an empty list plainly', async () => {
    savedJobsDao.getByUser.mockResolvedValue([]);
    expect(JSON.parse(textOf(await makeListSavedJobsHandler(ctx)())).count).toBe(0);
  });
});
