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

// The full job description, for reasoning about a single role (comparing it
// against a talent profile, answering questions about it, etc) — deliberately
// NOT included in search_jobs results, where a description per row would blow
// up response size for what's usually a list scan. `description` is stored as
// a JSON array of {heading, content[]} sections (see helper.js's
// parseDescriptionSections), sometimes as a JSON string rather than the
// native array depending on ingestion source.
export function formatJobFull(job) {
  let sections = null;
  try {
    sections = typeof job.description === 'string' ? JSON.parse(job.description) : job.description;
  } catch {
    sections = null;
  }

  const description = Array.isArray(sections) && sections.length > 0
    ? sections
        .map((s) => `${s.heading ? `${s.heading}:\n` : ''}${(s.content || []).join('\n')}`)
        .join('\n\n')
        .trim() || null
    : null;

  const skills = Array.isArray(job.skills)
    ? job.skills.filter((s) => s && typeof s === 'object' && s.slug).map((s) => ({ name: s.name, slug: s.slug }))
    : [];

  return {
    title: job.title,
    company: job.company,
    location: job.location ?? null,
    domain: job.domain ?? null,
    employment_type: job.employment_type ?? null,
    experience_level: job.experience_level ?? null,
    skills,
    compensation: job.metadata?.compensation ?? null,
    description,
    source: job.platform ?? null,
    posted_at: job.created_at ?? job.updated_at ?? null,
    apply_url: job.url ?? null,
    workway_url: siteUrl(`/job/${job.slug}`),
    slug: job.slug,
  };
}
