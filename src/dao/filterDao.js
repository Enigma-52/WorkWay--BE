import PostgresDao from './dao.js';

export const filterQ = {
  GET_JOBS_BY_DOMAIN: `
    SELECT j.*, c.logo_url AS company_logo_url, c.slug AS company_slug
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
    return this.getQ({
      sql: filterQ.GET_JOBS_PER_DOMAIN,
      values: [],
    });
  }
}

export const filtersDao = new FiltersDao();
