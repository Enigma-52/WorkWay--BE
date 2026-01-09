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
}

export const jobsDao = new JobsDao();
