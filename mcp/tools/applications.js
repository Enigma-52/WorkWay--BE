import { z } from 'zod';
import { applicationsDao } from '../../src/dao/applicationsDao.js';
import { jobsDao } from '../../src/dao/jobsDao.js';
import { siteUrl } from '../format.js';

const ok = (payload) => ({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
const okText = (text) => ({ content: [{ type: 'text', text }] });
const fail = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });

// Mirrors the dashboard's status pipeline — see workway-next's
// dashboard/seeker/applications/page.tsx statusConfig.
const APPLICATION_STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected'];

export function makeLogApplicationHandler(ctx) {
  return async (args = {}) => {
    const slug = String(args.job_slug ?? '').trim();
    if (!slug) return fail('A job slug is required.');

    // Resolve the job first so the row carries real title/company/url rather
    // than whatever the caller claimed — same rationale as save_job.
    const rows = await jobsDao.getSingleJob({ slug });
    const job = rows?.[0];
    if (!job) {
      return fail(`No job found with slug "${slug}". Use search_jobs to find the correct slug.`);
    }

    const result = await applicationsDao.addApplication({
      userId: ctx.user.id,
      jobSlug: job.slug,
      jobTitle: job.title,
      company: job.company,
      companyLogoUrl: job.company_logo_url ?? null,
      location: job.location ?? null,
      employmentType: job.employment_type ?? null,
    });

    if (!result?.length) {
      return okText(`"${job.title}" at ${job.company} is already logged. Use update_application_status to change its status.`);
    }

    return okText(
      `Logged your application to "${job.title}" at ${job.company}. Track it at ${siteUrl('/dashboard/seeker/applications')}`
    );
  };
}

export function makeUpdateApplicationStatusHandler(ctx) {
  return async (args = {}) => {
    const slug = String(args.job_slug ?? '').trim();
    if (!slug) return fail('A job slug is required.');
    if (!args.status && !args.notes) {
      return fail('Supply at least one of `status` or `notes` to update.');
    }

    const updated = await applicationsDao.updateApplicationByUserAndSlug({
      userId: ctx.user.id,
      jobSlug: slug,
      status: args.status,
      notes: args.notes,
    });

    if (!updated) {
      return fail(`No logged application found for "${slug}" on this account. Use log_application first.`);
    }

    return okText(`Updated "${slug}"${args.status ? ` to ${args.status}` : ''}.`);
  };
}

export function makeListApplicationsHandler(ctx) {
  return async () => {
    const rows = await applicationsDao.getByUser(ctx.user.id);
    return ok({
      count: rows.length,
      applications: rows.map((r) => ({
        title: r.job_title,
        company: r.company,
        status: r.status,
        notes: r.notes ?? null,
        applied_at: r.applied_at ?? null,
        workway_url: siteUrl(`/job/${r.job_slug}`),
      })),
      dashboard_url: siteUrl('/dashboard/seeker/applications'),
    });
  };
}

export function registerApplicationTools(server, ctx) {
  server.registerTool(
    'log_application',
    {
      title: 'Log a job application',
      description: 'Record that the signed-in WorkWay account applied to a job, so it can be tracked from the dashboard.',
      inputSchema: { job_slug: z.string().describe('Job slug, as returned by search_jobs') },
    },
    makeLogApplicationHandler(ctx)
  );

  server.registerTool(
    'update_application_status',
    {
      title: 'Update an application status',
      description: 'Update the status and/or notes on a previously logged application.',
      inputSchema: {
        job_slug: z.string().describe('Job slug of a previously logged application'),
        status: z.enum(APPLICATION_STATUSES).optional(),
        notes: z.string().optional(),
      },
    },
    makeUpdateApplicationStatusHandler(ctx)
  );

  server.registerTool(
    'list_applications',
    {
      title: 'List logged applications',
      description: 'List every job application logged on the signed-in WorkWay account, with status and notes.',
      inputSchema: {},
    },
    makeListApplicationsHandler(ctx)
  );
}
