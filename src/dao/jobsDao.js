import PostgresDao from './dao.js';

const JOB_FEED_COLS =
  'id,company_id,company,slug,platform,title,url,experience_level,employment_type,location,domain,updated_at';
export const jobsQ = {
  HOME_FEED: `
    SELECT ${JOB_FEED_COLS}
    FROM jobs
    WHERE ($1::bigint IS NULL OR id < $1)
    ORDER BY id DESC
    LIMIT $2;
  `,
  COMPANY_FEED: `
    SELECT ${JOB_FEED_COLS}
    FROM jobs
    WHERE company_id = $1;
  `,
};

class JobsDao extends PostgresDao {
  constructor() {
    super('jobs');
  }

  /**
   * Home feed pagination (keyset pagination)
   */
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
}

export const jobsDao = new JobsDao();
