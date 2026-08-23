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

  // Same as updateApplication, but keyed on job_slug rather than the row's
  // internal id — used by the MCP tool, which only ever knows a job by slug
  // (never the internal db id, same convention as save_job/unsave_job).
  async updateApplicationByUserAndSlug({ userId, jobSlug, status, notes }) {
    return this.getQ({
      sql: `
        UPDATE job_applications
        SET status = COALESCE($3, status), notes = COALESCE($4, notes)
        WHERE user_id = $1 AND job_slug = $2
        RETURNING *
      `,
      values: [userId, jobSlug, status ?? null, notes ?? null],
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

  async countByUserSince(userId, sinceDate) {
    const row = await this.getQ({
      sql: `SELECT COUNT(*)::int AS count FROM job_applications WHERE user_id = $1 AND applied_at >= $2`,
      values: [userId, sinceDate],
      firstResultOnly: true,
    });
    return row?.count ?? 0;
  }

  async getByUser(userId) {
    return this.getQ({
      sql: `SELECT * FROM job_applications WHERE user_id = $1 ORDER BY applied_at DESC`,
      values: [userId],
    });
  }
}

export const applicationsDao = new ApplicationsDao();
