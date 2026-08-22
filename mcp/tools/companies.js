import { z } from 'zod';
import { getCompanyDetails } from '../../src/services/companyService.js';
import { formatJob, siteUrl } from '../format.js';

const ok = (payload) => ({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
const fail = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });

export async function getCompanyOverviewHandler(args = {}) {
  const slug = String(args.company ?? '').trim().toLowerCase();
  if (!slug) return fail('A company slug is required.');

  const company = await getCompanyDetails(slug);
  if (!company) {
    return fail(
      `No company found for "${args.company}". Company slugs are lowercase and hyphenated, e.g. "y-combinator". Browse them at ${siteUrl('/companies')}.`
    );
  }

  return ok({
    name: company.name,
    slug: company.slug,
    description: company.description ?? null,
    website: company.website ?? null,
    total_open_roles: company.totalJobs ?? 0,
    roles_by_domain: (company.domainStats ?? []).map((d) => ({ domain: d.domain, count: d.count })),
    recent_jobs: (company.recentlyPostedJobs ?? []).map(formatJob),
    workway_url: siteUrl(`/company/${company.slug}`),
  });
}

export function registerCompanyTools(server) {
  server.registerTool(
    'get_company_overview',
    {
      title: 'Get company overview',
      description:
        'Look up a company on WorkWay: what it does, how many roles are open, the breakdown by domain, and its most recently posted jobs.',
      inputSchema: {
        company: z.string().describe("Company slug, e.g. 'stripe' or 'y-combinator'"),
      },
    },
    getCompanyOverviewHandler
  );
}
