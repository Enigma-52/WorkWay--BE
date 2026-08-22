import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/services/companyService.js', () => ({ getCompanyDetails: vi.fn() }));

const companyService = await import('../../../src/services/companyService.js');
const { getCompanyOverviewHandler } = await import('../../../mcp/tools/companies.js');

beforeEach(() => vi.clearAllMocks());
const textOf = (r) => r.content[0].text;

describe('get_company_overview', () => {
  it('errors clearly for an unknown company', async () => {
    companyService.getCompanyDetails.mockResolvedValue(null);
    const res = await getCompanyOverviewHandler({ company: 'nope' });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toContain('nope');
  });

  it('returns the open role count and recent jobs with apply links', async () => {
    companyService.getCompanyDetails.mockResolvedValue({
      name: 'Acme', slug: 'acme', description: 'Rockets', website: 'https://acme.com',
      totalJobs: 12,
      recentlyPostedJobs: [{ slug: 'acme-eng', title: 'Engineer', company: 'Acme', url: 'https://ats.example/1' }],
      domainStats: [{ domain: 'Software Engineering', count: 8 }],
    });

    const payload = JSON.parse(textOf(await getCompanyOverviewHandler({ company: 'acme' })));
    expect(payload.total_open_roles).toBe(12);
    expect(payload.recent_jobs[0].apply_url).toBe('https://ats.example/1');
    expect(payload.workway_url).toBe('https://workway.dev/company/acme');
  });

  it('lowercases the slug before lookup', async () => {
    companyService.getCompanyDetails.mockResolvedValue(null);
    await getCompanyOverviewHandler({ company: 'AcMe' });
    expect(companyService.getCompanyDetails).toHaveBeenCalledWith('acme');
  });
});
