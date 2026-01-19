import PostgresDao from './dao.js';

const JOB_FEED_COLS =
  'j.id,j.company_id,j.company,j.slug,j.platform,j.title,j.url,j.experience_level,j.employment_type,j.location,j.domain,j.updated_at';
export const jobsQ = {
  HOME_FEED: `
    SELECT ${JOB_FEED_COLS}
    FROM jobs j
    WHERE ($1::bigint IS NULL OR j.id < $1)
    ORDER BY j.id DESC
    LIMIT $2;
  `,
  COMPANY_FEED: `
    SELECT ${JOB_FEED_COLS}
    FROM jobs j
    WHERE j.company_id = $1;
  `,
  GET_SINGLE_JOB: `
    SELECT j.* , c.logo_url AS company_logo_url , c.slug AS company_slug
    FROM jobs j
    JOIN companies c ON j.company_id = c.id
    WHERE j.slug = $1;
  `,
  GET_DOMAIN_JOB_EXCLUSION: `
    SELECT ${JOB_FEED_COLS} , c.logo_url AS company_logo_url
    FROM jobs j
    JOIN companies c ON j.company_id = c.id
    WHERE j.domain = $1 AND j.slug != $2
    ORDER BY j.created_at DESC
    LIMIT 3;
  `,
  GET_COMPANY_JOB_EXCLUSION: `
    SELECT ${JOB_FEED_COLS} , c.logo_url AS company_logo_url , c.slug AS company_slug
    FROM jobs j
    JOIN companies c ON j.company_id = c.id
    WHERE j.company = $1 AND j.slug != $2
    ORDER BY j.created_at DESC
    LIMIT 3;
  `,
};

class JobsDao extends PostgresDao {
  constructor() {
    super('jobs');
  }

  async getHomeJobFeed({ lastJobId, limit }) {
    return this.getQ({
      sql: jobsQ.HOME_FEED,
      values: [lastJobId, limit],
    });
  }

  async getCompanyJobFeed({ companyId }) {
    return this.getQ({
      sql: jobsQ.COMPANY_FEED,
      values: [companyId],
    });
  }

  async getSingleJob({ slug }) {
    return this.getQ({
      sql: jobsQ.GET_SINGLE_JOB,
      values: [slug],
    });
  }

  async getDomainJobwithExclusion({ domain, excludeSlug }) {
    return this.getQ({
      sql: jobsQ.GET_DOMAIN_JOB_EXCLUSION,
      values: [domain, excludeSlug],
    });
  }

  async getCompanyJobwithExclusion({ company, excludeSlug }) {
    return this.getQ({
      sql: jobsQ.GET_COMPANY_JOB_EXCLUSION,
      values: [company, excludeSlug],
    });
  }
}

export const jobsDao = new JobsDao();
