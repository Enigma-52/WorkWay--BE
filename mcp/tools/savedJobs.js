import { z } from 'zod';
import { savedJobsDao } from '../../src/dao/savedJobsDao.js';
import { jobsDao } from '../../src/dao/jobsDao.js';
import { siteUrl } from '../format.js';

const ok = (payload) => ({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
const okText = (text) => ({ content: [{ type: 'text', text }] });
const fail = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });

export function makeSaveJobHandler(ctx) {
  return async (args = {}) => {
    const slug = String(args.job_slug ?? '').trim();
    if (!slug) return fail('A job slug is required.');

    // Resolve the job first so the saved row carries real title/company/url
    // rather than whatever the caller claimed.
    const rows = await jobsDao.getSingleJob({ slug });
    const job = rows?.[0];
    if (!job) {
      return fail(`No job found with slug "${slug}". Use search_jobs to find the correct slug.`);
    }

    await savedJobsDao.saveJob({
      userId: ctx.user.id,
      jobSlug: job.slug,
      jobTitle: job.title,
      company: job.company,
      companyLogoUrl: job.company_logo_url ?? null,
      location: job.location ?? null,
      employmentType: job.employment_type ?? null,
      jobUrl: job.url ?? null,
    });

    return okText(
      `Saved "${job.title}" at ${job.company}. See all your saved jobs at ${siteUrl('/dashboard/seeker/saved-jobs')}`
    );
  };
}

export function makeListSavedJobsHandler(ctx) {
  return async () => {
    const rows = await savedJobsDao.getByUser(ctx.user.id);
    return ok({
      count: rows.length,
      saved_jobs: rows.map((r) => ({
        title: r.job_title,
        company: r.company,
        location: r.location ?? null,
        employment_type: r.employment_type ?? null,
        saved_at: r.created_at ?? null,
        apply_url: r.job_url ?? null,
        workway_url: siteUrl(`/job/${r.job_slug}`),
      })),
      dashboard_url: siteUrl('/dashboard/seeker/saved-jobs'),
    });
  };
}

export function registerSavedJobTools(server, ctx) {
  server.registerTool(
    'save_job',
    {
      title: 'Save a job',
      description: 'Save a job to the signed-in WorkWay account so it can be revisited from the dashboard.',
      inputSchema: { job_slug: z.string().describe('Job slug, as returned by search_jobs') },
    },
    makeSaveJobHandler(ctx)
  );

  server.registerTool(
    'list_saved_jobs',
    {
      title: 'List saved jobs',
      description: 'List every job saved to the signed-in WorkWay account.',
      inputSchema: {},
    },
    makeListSavedJobsHandler(ctx)
  );
}
