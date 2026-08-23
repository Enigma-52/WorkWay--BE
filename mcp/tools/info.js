import { z } from 'zod';
import { getCompanyOverview } from '../../src/services/companyService.js';
import { getAllDomainJobs } from '../../src/services/filterService.js';
import { JOB_PLATFORMS, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from '../../src/utils/constants.js';
import { SITE_ORIGIN, siteUrl } from '../format.js';
import { DOCS_ORIGIN } from '../resources.js';

const ok = (payload) => ({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });

const TOPICS = ['overview', 'coverage', 'filters', 'api', 'plans'];

export async function getWorkwayInfoHandler(args = {}) {
  const topic = args.topic ?? 'overview';

  if (topic === 'coverage' || topic === 'overview') {
    const [overview, domains] = await Promise.all([getCompanyOverview(), getAllDomainJobs()]);
    const sorted = (domains ?? [])
      .map((d) => ({ domain: d.domain, slug: d.slug, open_roles: Number(d.job_count ?? 0) }))
      .sort((a, b) => b.open_roles - a.open_roles);

    const coverage = {
      total_active_jobs: Number(overview?.stats?.total_jobs ?? 0),
      total_companies: Number(overview?.stats?.total_companies ?? 0),
      ats_sources: JOB_PLATFORMS,
      domains: sorted,
    };

    if (topic === 'coverage') return ok(coverage);

    return ok({
      what_is_workway:
        'A job search engine that indexes openings directly from the applicant tracking systems companies hire through (Greenhouse, Ashby, Y Combinator) instead of re-hosting listings from other job boards. Every result links to the company\'s original posting.',
      why_it_is_different: [
        'Direct apply — results link to the real ATS posting; WorkWay never proxies an application.',
        'No duplicate or re-posted listings; one row per real opening.',
        'Refreshed daily, so results reflect what is actually live.',
      ],
      coverage,
      plans: {
        free: 'Search, save jobs, follow companies, publish a talent profile.',
        pro: 'Everything in free, plus an instant email the moment a followed company posts a new role.',
        note: 'Following a company works on every plan. Only the email delivery is Pro-only.',
        pricing_url: siteUrl('/pricing'),
      },
      links: {
        site: SITE_ORIGIN,
        jobs: siteUrl('/jobs'),
        companies: siteUrl('/companies'),
        talents: siteUrl('/talents'),
        mcp_docs: DOCS_ORIGIN,
      },
      next_steps:
        'Call list_domains for valid domain slugs, then search_jobs to find roles. Ask for topic "filters" to see every accepted filter value.',
    });
  }

  if (topic === 'filters') {
    const domains = await getAllDomainJobs();
    return ok({
      note: 'Use these exact values. Anything else is rejected with the allowed list.',
      platform: JOB_PLATFORMS,
      employment_type: EMPLOYMENT_TYPES,
      experience_level: EXPERIENCE_LEVELS,
      posted: ['today', '3d', '7d', '30d'],
      country: 'ISO alpha-3 code, e.g. USA, IND, DEU',
      domain: (domains ?? []).map((d) => d.slug).filter(Boolean),
      sort: ['recent'],
      pagination: { page: 'integer >= 1', limit: 'integer 1-50, default 20' },
    });
  }

  if (topic === 'api') {
    return ok({
      base_url: 'https://www.workway.dev',
      mcp_endpoint: 'https://www.workway.dev/api/mcp',
      docs: DOCS_ORIGIN,
      note: 'These MCP tools call the same services as the public REST API below, so results never diverge from the website.',
      public_read_endpoints: {
        'GET /api/job/list':
          'Paginated job search. Params: q, domain, location, country, company_slug, employment_type, experience_level, platform, posted, page, limit, sort.',
        'GET /api/job/details?slug=': 'One job with full description and related roles.',
        'GET /api/job/filters': 'Global facet counts.',
        'GET /api/job/salary-insights': 'Salary distribution and averages by domain and level.',
        'GET /api/company': 'Paginated company directory.',
        'GET /api/company/details?slug=': 'One company with recent roles and domain stats.',
        'GET /api/company/overview': 'Global totals, trending, recently added, actively hiring.',
        'GET /api/filter/domain/all': 'Every domain with open-role counts.',
        'GET /api/talent-profiles/search': 'Public talent directory.',
      },
      account_endpoints: [
        '/api/saved-jobs',
        '/api/alerts',
        '/api/talent-profiles/me',
        '/api/applications',
        '/api/api-keys',
      ],
      auth: {
        rest: 'Session-based for the website.',
        mcp: 'Authorization: Bearer <workway-api-key>. Keys are SHA-256 hashed at rest, support optional expiry, and can be revoked.',
        manage_keys_url: siteUrl('/dashboard/seeker/api-keys'),
      },
      sitemaps: siteUrl('/api/sitemap.xml'),
    });
  }

  // topic === 'plans'
  return ok({
    free: {
      price: '$0',
      includes: [
        'Unlimited job search and filtering',
        'Save jobs to your dashboard',
        'Follow companies',
        'Publish a public talent profile',
        'API key access to this MCP server',
      ],
    },
    pro: {
      includes: [
        'Everything in Free',
        'Instant email the moment a followed company posts a new role (not a daily digest)',
        'Multiple new roles arrive as one clean digest rather than a flood',
      ],
    },
    important:
      'follow_company succeeds on every plan — free accounts can follow as many companies as they like. Pro changes only whether the alert email is delivered.',
    pricing_url: siteUrl('/pricing'),
  });
}

export function registerInfoTools(server) {
  server.registerTool(
    'get_workway_info',
    {
      title: 'About WorkWay and how to use it',
      description:
        'Background on WorkWay — what it is, live coverage numbers, every accepted filter value, the underlying REST API, and how free vs Pro differ. Call this when you need context before searching, or to look up valid filter values.',
      inputSchema: {
        topic: z
          .enum(TOPICS)
          .optional()
          .describe(
            "Which section to return. 'overview' (default) is the general introduction; 'coverage' is live job/company/domain counts; 'filters' lists every accepted filter value; 'api' documents the REST API; 'plans' explains free vs Pro."
          ),
      },
    },
    getWorkwayInfoHandler
  );
}
