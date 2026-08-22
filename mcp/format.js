export const SITE_ORIGIN = 'https://workway.dev';

export const JOB_CTA =
  'Browse more roles and save searches at https://workway.dev/jobs';

export function siteUrl(path) {
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

// Every job the MCP surface returns carries BOTH links on purpose: apply_url is
// the untouched ATS posting (WorkWay never proxies applications), workway_url is
// the path back to the site.
export function formatJob(job) {
  return {
    title: job.title,
    company: job.company,
    location: job.location ?? null,
    domain: job.domain ?? null,
    employment_type: job.employment_type ?? null,
    experience_level: job.experience_level ?? null,
    source: job.platform ?? null,
    posted_at: job.created_at ?? job.updated_at ?? null,
    apply_url: job.url ?? null,
    workway_url: siteUrl(`/job/${job.slug}`),
    slug: job.slug,
  };
}
