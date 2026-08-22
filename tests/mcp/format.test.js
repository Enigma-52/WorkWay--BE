import { describe, it, expect } from 'vitest';
const { formatJob, JOB_CTA, siteUrl } = await import('../../mcp/format.js');

describe('formatJob', () => {
  const job = {
    slug: 'acme-eng', title: 'Engineer', company: 'Acme',
    location: 'Remote', url: 'https://boards.greenhouse.io/acme/1',
    employment_type: 'Full-Time', experience_level: 'Senior',
    domain: 'Software Engineering', platform: 'greenhouse',
  };

  it('keeps the original ATS apply link intact', () => {
    expect(formatJob(job).apply_url).toBe('https://boards.greenhouse.io/acme/1');
  });

  it('adds a workway.dev job link', () => {
    expect(formatJob(job).workway_url).toBe('https://workway.dev/job/acme-eng');
  });

  it('never emits a .io url', () => {
    expect(JSON.stringify(formatJob(job))).not.toContain('workway.io');
  });
});

describe('siteUrl', () => {
  it('builds absolute workway.dev urls', () => {
    expect(siteUrl('/jobs')).toBe('https://workway.dev/jobs');
  });
});

describe('JOB_CTA', () => {
  it('mentions workway.dev', () => {
    expect(JOB_CTA).toContain('workway.dev');
  });
});
