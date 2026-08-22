import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/services/jobService.js', () => ({
  normalizeAndValidateListParams: vi.fn(),
  getJobList: vi.fn(),
}));
vi.mock('../../../src/services/filterService.js', () => ({
  getAllDomainJobs: vi.fn(),
}));

const jobService = await import('../../../src/services/jobService.js');
const filterService = await import('../../../src/services/filterService.js');
const { searchJobsHandler, listDomainsHandler } = await import('../../../mcp/tools/jobs.js');

beforeEach(() => vi.clearAllMocks());

const textOf = (result) => result.content[0].text;

describe('search_jobs', () => {
  it('surfaces validation errors with the allowed values', async () => {
    jobService.normalizeAndValidateListParams.mockReturnValue({
      error: true, status: 400, message: "Invalid platform: wat. Allowed: greenhouse, ashby, ycombinator, or 'all'.",
    });
    const res = await searchJobsHandler({ platform: 'wat' });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toContain('greenhouse');
    expect(jobService.getJobList).not.toHaveBeenCalled();
  });

  it('returns jobs with both the ATS link and the workway.dev link', async () => {
    jobService.normalizeAndValidateListParams.mockReturnValue({ filters: {}, page: 1, limit: 20, sort: 'recent' });
    jobService.getJobList.mockResolvedValue({
      jobs: [{ slug: 'acme-eng', title: 'Engineer', company: 'Acme', url: 'https://ats.example/1' }],
      meta: { total: 1, page: 1, total_pages: 1 },
    });

    const payload = JSON.parse(textOf(await searchJobsHandler({ query: 'engineer' })));
    expect(payload.jobs[0].apply_url).toBe('https://ats.example/1');
    expect(payload.jobs[0].workway_url).toBe('https://workway.dev/job/acme-eng');
  });

  it('includes the CTA and the total count', async () => {
    jobService.normalizeAndValidateListParams.mockReturnValue({ filters: {}, page: 1, limit: 20, sort: 'recent' });
    jobService.getJobList.mockResolvedValue({ jobs: [], meta: { total: 0, page: 1, total_pages: 0 } });

    const payload = JSON.parse(textOf(await searchJobsHandler({})));
    expect(payload.cta).toContain('workway.dev');
    expect(payload.total).toBe(0);
  });

  it('maps tool arg names onto the REST query param names', async () => {
    jobService.normalizeAndValidateListParams.mockReturnValue({ filters: {}, page: 1, limit: 20, sort: 'recent' });
    jobService.getJobList.mockResolvedValue({ jobs: [], meta: {} });

    await searchJobsHandler({ query: 'eng', employment_type: 'Full-Time', platform: 'ashby', page: 2 });
    expect(jobService.normalizeAndValidateListParams).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'eng', employment_type: 'Full-Time', platform: 'ashby', page: 2 })
    );
  });
});

describe('list_domains', () => {
  // getJobsPerDomain aliases the count as job_count (see filterDao GET_JOBS_PER_DOMAIN),
  // so the mock uses that name — mapping it from `count` silently drops the number.
  it('returns domains with counts', async () => {
    filterService.getAllDomainJobs.mockResolvedValue([{ domain: 'Software Engineering', slug: 'software-engineering', job_count: 120 }]);
    const payload = JSON.parse(textOf(await listDomainsHandler()));
    expect(payload.domains[0].slug).toBe('software-engineering');
    expect(payload.domains[0].job_count).toBe(120);
  });
});
