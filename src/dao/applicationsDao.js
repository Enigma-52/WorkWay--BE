import PostgresDao from './dao.js';

class ApplicationsDao extends PostgresDao {
  constructor() {
    super('job_applications');
  }

  async addApplication({ userId, jobSlug, jobTitle, company, companyLogoUrl, location, employmentType }) {
    return this.getQ({
      sql: `
        INSERT INTO job_applications (user_id, job_slug, job_title, company, company_logo_url, location, employment_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, job_slug) DO NOTHING
        RETURNING *
      `,
      values: [userId, jobSlug, jobTitle, company, companyLogoUrl ?? null, location ?? null, employmentType ?? null],
    });
  }

  async updateApplication({ id, userId, status, notes }) {
    return this.getQ({
      sql: `
        UPDATE job_applications
        SET status = COALESCE($3, status), notes = COALESCE($4, notes)
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `,
      values: [id, userId, status ?? null, notes ?? null],
      firstResultOnly: true,
    });
  }

  async countByUser(userId) {
    return this.getQ({
      sql: `SELECT COUNT(*)::int AS count FROM job_applications WHERE user_id = $1`,
      values: [userId],
      firstResultOnly: true,
    });
  }

  async getByUser(userId) {
    return this.getQ({
      sql: `SELECT * FROM job_applications WHERE user_id = $1 ORDER BY applied_at DESC`,
      values: [userId],
    });
  }
}

export const applicationsDao = new ApplicationsDao();
