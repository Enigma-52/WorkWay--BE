import PostgresDao from './dao.js';

export const filterQ = {
  GET_JOBS_BY_DOMAIN: `
    SELECT j.id, j.company_id, j.company, j.slug, j.platform, j.title, j.url,
      j.description, j.experience_level, j.employment_type, j.location, j.domain,
      j.skills, j.updated_at, j.created_at, j.metadata,
      c.logo_url AS company_logo_url, c.slug AS company_slug
    FROM jobs j
    JOIN companies c ON j.company_id = c.id
    WHERE j.domain = $1
      AND ($2 = 'all' OR j.employment_type = $2)
      AND ($3 = 'all' OR j.experience_level = $3)
      AND ($4 = 'all' OR j.location ILIKE '%' || $4 || '%')
    ORDER BY j.created_at DESC
    LIMIT $5 OFFSET $6;
  `,
  GET_JOBS_PER_DOMAIN: `
    SELECT domain, COUNT(*)::int AS job_count
    FROM jobs
    GROUP BY domain;
  `,
};

// getJobsPerDomain() is a zero-parameter, fully global GROUP BY over the
// whole jobs table, recomputed on every /domains pageview even though it
// only changes when ingestion crons run. Cache it.
const JOBS_PER_DOMAIN_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let jobsPerDomainCache = null; // { result, expiresAt }

class FiltersDao extends PostgresDao {
  constructor() {
    super('jobs');
  }

  async getJobsByDomain({
    domainName,
    limit,
    offset,
    employment_type,
    employment_level,
    location,
  }) {
    return this.getQ({
      sql: filterQ.GET_JOBS_BY_DOMAIN,
      values: [domainName, employment_type, employment_level, location, limit, offset],
    });
  }
  async getJobsPerDomain() {
    if (jobsPerDomainCache && jobsPerDomainCache.expiresAt > Date.now()) {
      return jobsPerDomainCache.result;
    }
    const result = await this.getQ({
      sql: filterQ.GET_JOBS_PER_DOMAIN,
      values: [],
    });
    jobsPerDomainCache = { result, expiresAt: Date.now() + JOBS_PER_DOMAIN_CACHE_TTL_MS };
    return result;
  }

  // Called after ingestion crons finish so the next request recomputes
  // fresh data instead of waiting out the full 24h TTL.
  clearCache() {
    jobsPerDomainCache = null;
  }
}

export const filtersDao = new FiltersDao();
