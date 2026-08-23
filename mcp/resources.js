import { getCompanyOverview } from '../src/services/companyService.js';
import { getAllDomainJobs } from '../src/services/filterService.js';
import { JOB_PLATFORMS, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from '../src/utils/constants.js';
import { SITE_ORIGIN, siteUrl } from './format.js';

// Docs are published as Markdown-first pages, so an agent can fetch any of
// these URLs directly and get prose rather than an HTML shell.
export const DOCS_ORIGIN = 'https://docs.workway.dev';

const text = (uri, body) => ({
  contents: [{ uri, mimeType: 'text/markdown', text: body }],
});

function aboutBody({ totalJobs, totalCompanies, domains }) {
  const domainLines = domains
    .slice(0, 12)
    .map((d) => `- ${d.name} (${d.job_count.toLocaleString()} open)`)
    .join('\n');

  return `# About WorkWay

WorkWay is a job search engine that indexes roles directly from the applicant
tracking systems companies actually hire through — Greenhouse, Ashby, and
Y Combinator's job board — rather than re-hosting listings from other job boards.

**Why that matters:** most openings never reach the big aggregators. They live on
a company's own careers page, posted through its ATS, and stay there until
someone happens to look. WorkWay reads those boards continuously so the listings
surface in one searchable feed, with the original apply link intact.

## What makes it different

- **Direct apply, always.** Every result links to the company's real posting.
  WorkWay never proxies an application or inserts its own form.
- **No duplicate or re-posted listings.** One row per real opening.
- **Refreshed daily**, so results reflect what is actually live rather than a
  months-old snapshot.

## Current coverage

- **${totalJobs.toLocaleString()}** active job listings
- **${totalCompanies.toLocaleString()}** companies
- **${domains.length}** job domains
- Sources: ${JOB_PLATFORMS.join(', ')}

### Largest domains

${domainLines}

## Accounts and plans

A free WorkWay account can search, save jobs, follow companies, and publish a
talent profile. **Pro** adds instant email alerts: the moment a company you
follow posts a new role, you get an email — not a daily digest. Following a
company works on every plan; only the email delivery is Pro-only.

Pricing: ${siteUrl('/pricing')}

## Links

- Site: ${SITE_ORIGIN}
- Job search: ${siteUrl('/jobs')}
- Companies: ${siteUrl('/companies')}
- Talent directory: ${siteUrl('/talents')}
- MCP docs: ${DOCS_ORIGIN}
`;
}

function toolsBody() {
  return `# WorkWay MCP tools

Nine tools, all requiring a WorkWay API key. Generate one at
${siteUrl('/dashboard/seeker/api-keys')} and send it as \`Authorization: Bearer <key>\`.

## Read

| Tool | Purpose |
|---|---|
| \`search_jobs\` | Search live openings by text, domain, location, country, company, employment type, experience level, ATS source, or recency. Paginated. |
| \`get_company_overview\` | One company: description, open-role count, breakdown by domain, most recent postings. |
| \`list_domains\` | Every job domain with its current open-role count. Use this to discover valid \`domain\` slugs. |
| \`list_saved_jobs\` | Jobs saved to the calling account. |
| \`list_alerts\` | Companies the calling account follows, plus whether email alerts are active on this plan. |
| \`get_talent_profile\` | The calling account's talent profile, with experience, education, and certifications. |

## Write

| Tool | Purpose |
|---|---|
| \`save_job\` | Save a job by slug to the calling account. |
| \`follow_company\` | Follow a company. Works on every plan; instant email alerts require Pro. |
| \`update_talent_profile\` | Create or patch the calling account's talent profile. Only supplied fields change. |

## Filter vocabularies

Use these exact values — anything else is rejected with the allowed list.

- **ATS source** (\`platform\`): ${JOB_PLATFORMS.join(', ')}
- **Employment type**: ${EMPLOYMENT_TYPES.join(', ')}
- **Experience level**: ${EXPERIENCE_LEVELS.join(', ')}
- **Posted within** (\`posted\`): today, 3d, 7d, 30d
- **Domain**: a slug from \`list_domains\`, e.g. \`software-engineering\`
- **Country**: ISO alpha-3, e.g. \`USA\`, \`IND\`, \`DEU\`

## Result shape

Every job carries two links, deliberately:

- \`apply_url\` — the untouched ATS posting. Send people here to apply.
- \`workway_url\` — the role's page on ${SITE_ORIGIN}, for context and related roles.

## Conventions

- Job and company identifiers are **slugs**, not numeric ids. Get a job slug
  from \`search_jobs\`; get a company slug from \`search_jobs\` results or
  ${siteUrl('/companies')}.
- Write tools always act on the account that owns the API key. There is no way
  to act on another account.
`;
}

function apiBody() {
  return `# WorkWay REST API

The MCP server is a wrapper over WorkWay's own HTTP API. Every tool calls the
same services the website uses, so results never diverge between the two.

Base URL: \`https://api.workway.dev\`

## Public read endpoints

| Endpoint | Returns |
|---|---|
| \`GET /api/job/list\` | Paginated job search. Accepts \`q\`, \`domain\`, \`location\`, \`country\`, \`company_slug\`, \`employment_type\`, \`experience_level\`, \`platform\`, \`posted\`, \`page\`, \`limit\`, \`sort\`. Returns \`jobs\`, \`meta\`, \`applied_filters\`, \`facets\`. |
| \`GET /api/job/details?slug=\` | One job with full description, similar roles, and other roles at the same company. |
| \`GET /api/job/filters\` | Global facet counts for the search UI. |
| \`GET /api/job/salary-insights\` | Salary distribution and averages by domain and level. |
| \`GET /api/company\` | Paginated company directory. |
| \`GET /api/company/details?slug=\` | One company plus its recent roles and domain stats. |
| \`GET /api/company/overview\` | Global company/job totals, trending, recently added, actively hiring. |
| \`GET /api/filter/domain/all\` | Every domain with open-role counts. |
| \`GET /api/talent-profiles/search\` | Public talent directory. |

## Account endpoints

Used by the site with a session, and by MCP tools with an API key:
\`/api/saved-jobs\`, \`/api/alerts\`, \`/api/talent-profiles/me\`,
\`/api/applications\`, \`/api/api-keys\`.

## MCP endpoint

\`POST https://api.workway.dev/mcp\` — Streamable HTTP transport, stateless.
Requires \`Authorization: Bearer <workway-api-key>\`.

## Sitemaps

\`/api/sitemap.xml\` indexes per-type sitemaps for jobs, companies, domains,
skills, talents, and location pages.

## Rate limits and auth

Read endpoints are public. API-key creation is limited to 20 keys per hour per
account. Keys are stored as SHA-256 hashes, can carry an expiry, and can be
revoked at any time from ${siteUrl('/dashboard/seeker/api-keys')}.
`;
}

export function registerResources(server) {
  server.registerResource(
    'about-workway',
    'workway://about',
    {
      title: 'About WorkWay',
      description:
        'What WorkWay is, how its job data is sourced, live coverage numbers, and how free vs Pro plans differ. Read this first for context on the other tools.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      // Both calls are 24h-cached upstream, so this stays cheap while never
      // going stale the way hardcoded coverage numbers would.
      const [overview, domains] = await Promise.all([
        getCompanyOverview(),
        getAllDomainJobs(),
      ]);

      return text(
        uri.href,
        aboutBody({
          totalJobs: Number(overview?.stats?.total_jobs ?? 0),
          totalCompanies: Number(overview?.stats?.total_companies ?? 0),
          domains: (domains ?? [])
            .map((d) => ({ name: d.domain, job_count: Number(d.job_count ?? 0) }))
            .sort((a, b) => b.job_count - a.job_count),
        })
      );
    }
  );

  server.registerResource(
    'workway-tools',
    'workway://tools',
    {
      title: 'WorkWay MCP tool guide',
      description:
        'Catalog of all nine WorkWay tools, the exact filter vocabularies they accept, the two links every job result carries, and slug conventions.',
      mimeType: 'text/markdown',
    },
    async (uri) => text(uri.href, toolsBody())
  );

  server.registerResource(
    'workway-api',
    'workway://api',
    {
      title: 'WorkWay REST API reference',
      description:
        "Reference for WorkWay's underlying HTTP API — the same endpoints these MCP tools call — plus the MCP endpoint, sitemaps, and auth model.",
      mimeType: 'text/markdown',
    },
    async (uri) => text(uri.href, apiBody())
  );
}
