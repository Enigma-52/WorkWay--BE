import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/services/companyService.js', () => ({ getCompanyOverview: vi.fn() }));
vi.mock('../../../src/services/filterService.js', () => ({ getAllDomainJobs: vi.fn() }));

const companyService = await import('../../../src/services/companyService.js');
const filterService = await import('../../../src/services/filterService.js');
const { getWorkwayInfoHandler } = await import('../../../mcp/tools/info.js');

beforeEach(() => {
  vi.clearAllMocks();
  companyService.getCompanyOverview.mockResolvedValue({
    stats: { total_jobs: 497471, total_companies: 6100 },
  });
  filterService.getAllDomainJobs.mockResolvedValue([
    { domain: 'Software Engineering', slug: 'software-engineering', job_count: 104540 },
    { domain: 'Design', slug: 'design', job_count: 3200 },
  ]);
});

const payloadOf = async (args) => JSON.parse((await getWorkwayInfoHandler(args)).content[0].text);

describe('get_workway_info', () => {
  it('defaults to the overview topic', async () => {
    const p = await payloadOf({});
    expect(p.what_is_workway).toMatch(/applicant tracking/i);
    expect(p.coverage.total_active_jobs).toBe(497471);
  });

  it('reports live coverage rather than hardcoded numbers', async () => {
    companyService.getCompanyOverview.mockResolvedValue({ stats: { total_jobs: 1, total_companies: 2 } });
    const p = await payloadOf({ topic: 'coverage' });
    expect(p.total_active_jobs).toBe(1);
    expect(p.total_companies).toBe(2);
  });

  it('sorts domains by open roles, biggest first', async () => {
    const p = await payloadOf({ topic: 'coverage' });
    expect(p.domains[0].slug).toBe('software-engineering');
  });

  it('lists real filter vocabularies including domain slugs', async () => {
    const p = await payloadOf({ topic: 'filters' });
    expect(p.platform).toEqual(['greenhouse', 'ashby', 'ycombinator']);
    expect(p.employment_type).toContain('Full-Time');
    expect(p.domain).toContain('software-engineering');
  });

  it('documents the REST API and the MCP endpoint', async () => {
    const p = await payloadOf({ topic: 'api' });
    expect(p.mcp_endpoint).toBe('https://www.workway.dev/api/mcp');
    expect(p.public_read_endpoints['GET /api/job/list']).toMatch(/platform/);
  });

  it('states that following is never plan-gated', async () => {
    const p = await payloadOf({ topic: 'plans' });
    expect(p.important).toMatch(/every plan/i);
  });

  it('never emits a workway.io url', async () => {
    for (const topic of ['overview', 'coverage', 'filters', 'api', 'plans']) {
      const raw = (await getWorkwayInfoHandler({ topic })).content[0].text;
      expect(raw).not.toContain('workway.io');
    }
  });
});
