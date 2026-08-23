import { z } from 'zod';
import { normalizeAndValidateListParams, getJobList } from '../../src/services/jobService.js';
import { getAllDomainJobs } from '../../src/services/filterService.js';
import { jobsDao } from '../../src/dao/jobsDao.js';
import { formatJob, formatJobFull, JOB_CTA, siteUrl } from '../format.js';

const ok = (payload) => ({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
const fail = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });

export async function searchJobsHandler(args = {}) {
  // Delegating validation to the REST service keeps MCP and /api/job/list from
  // ever disagreeing about what a valid domain/platform/level is.
  const validated = normalizeAndValidateListParams({
    q: args.query,
    domain: args.domain,
    location: args.location,
    country: args.country,
    company_slug: args.company,
    employment_type: args.employment_type,
    experience_level: args.experience_level,
    platform: args.platform,
    posted: args.posted,
    skill: args.skill,
    page: args.page,
    limit: args.limit,
  });

  if (validated.error) return fail(validated.message);

  const data = await getJobList(validated);
  return ok({
    total: data.meta?.total ?? 0,
    page: data.meta?.page ?? 1,
    total_pages: data.meta?.total_pages ?? 0,
    jobs: (data.jobs ?? []).map(formatJob),
    cta: JOB_CTA,
  });
}

// Deliberately separate from search_jobs: the full description is too heavy
// to carry on every row of a list response, but is exactly what's needed to
// reason about one specific role (e.g. comparing it against a talent profile).
export async function getJobDetailsHandler(args = {}) {
  const slug = String(args.job_slug ?? '').trim();
  if (!slug) return fail('A job slug is required.');

  const rows = await jobsDao.getSingleJob({ slug });
  const job = rows?.[0];
  if (!job) {
    return fail(`No job found with slug "${slug}". Use search_jobs to find the correct slug.`);
  }

  return ok(formatJobFull(job));
}

export async function listDomainsHandler() {
  const domains = await getAllDomainJobs();
  return ok({
    domains: domains.map((d) => ({ name: d.domain, slug: d.slug, job_count: d.job_count })),
    cta: `Browse by domain at ${siteUrl('/domains')}`,
  });
}

export function registerJobTools(server) {
  server.registerTool(
    'search_jobs',
    {
      title: 'Search WorkWay jobs',
      description:
        'Search live job openings aggregated from company ATS platforms (Greenhouse, Ashby, Y Combinator). Returns the original apply link for each role.',
      inputSchema: {
        query: z.string().optional().describe('Free text matched against job title and company'),
        domain: z.string().optional().describe("Domain slug, e.g. 'software-engineering'"),
        location: z.string().optional().describe("Location substring, e.g. 'Remote' or 'Berlin'"),
        country: z.string().optional().describe('ISO alpha-3 country code'),
        company: z.string().optional().describe('Company slug'),
        employment_type: z.enum(['Full-Time', 'Part-Time', 'Contract']).optional(),
        experience_level: z
          .enum(['Intern', 'Junior', 'Mid-level', 'Senior', 'Staff', 'Lead', 'Manager', 'Director'])
          .optional(),
        platform: z.enum(['greenhouse', 'ashby', 'ycombinator']).optional().describe('ATS source'),
        posted: z.enum(['today', '3d', '7d', '30d']).optional().describe('Only roles posted within this window'),
        skill: z.string().optional().describe("Skill slug, e.g. 'python' or 'kubernetes'"),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    searchJobsHandler
  );

  server.registerTool(
    'get_job_details',
    {
      title: 'Get full job details',
      description:
        'Fetch one job by slug with its full description, required skills, and compensation if listed — everything needed to reason about the role (e.g. comparing it against a talent profile). search_jobs results deliberately omit the full description; use this to get it.',
      inputSchema: {
        job_slug: z.string().describe('Job slug, as returned by search_jobs'),
      },
    },
    getJobDetailsHandler
  );

  server.registerTool(
    'list_domains',
    {
      title: 'List job domains',
      description: 'List every job domain on WorkWay with its current open-role count.',
      inputSchema: {},
    },
    listDomainsHandler
  );
}
