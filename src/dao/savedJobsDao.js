import PostgresDao from './dao.js';

class SavedJobsDao extends PostgresDao {
  constructor() {
    super('saved_jobs');
  }

  async saveJob({ userId, jobSlug, jobTitle, company, companyLogoUrl, location, employmentType, jobUrl }) {
    return this.getQ({
      sql: `
        INSERT INTO saved_jobs (user_id, job_slug, job_title, company, company_logo_url, location, employment_type, job_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, job_slug) DO NOTHING
        RETURNING *
      `,
      values: [userId, jobSlug, jobTitle, company, companyLogoUrl ?? null, location ?? null, employmentType ?? null, jobUrl ?? null],
    });
  }

  async unsaveJob({ userId, jobSlug }) {
    return this.getQ({
      sql: `DELETE FROM saved_jobs WHERE user_id = $1 AND job_slug = $2 RETURNING id`,
      values: [userId, jobSlug],
    });
  }

  async getByUser(userId) {
    return this.getQ({
      sql: `SELECT * FROM saved_jobs WHERE user_id = $1 ORDER BY saved_at DESC`,
      values: [userId],
    });
  }

  async countByUser(userId) {
    return this.getQ({
      sql: `SELECT COUNT(*)::int AS count FROM saved_jobs WHERE user_id = $1`,
      values: [userId],
      firstResultOnly: true,
    });
  }
}

export const savedJobsDao = new SavedJobsDao();
