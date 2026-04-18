import PostgresDao from './dao.js';

// Migration SQL (run once):
//
// CREATE TABLE IF NOT EXISTS job_alerts (
//   id            SERIAL PRIMARY KEY,
//   user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//   alert_type    TEXT NOT NULL DEFAULT 'company',   -- 'company' | 'keyword' | 'domain' | 'location' | etc.
//   company_slug  TEXT,
//   company_name  TEXT,
//   company_logo_url TEXT,
//   metadata      JSONB NOT NULL DEFAULT '{}',       -- future alert config lives here
//   created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   UNIQUE(user_id, alert_type, company_slug)
// );
// CREATE INDEX IF NOT EXISTS idx_job_alerts_user_id ON job_alerts(user_id);
// CREATE INDEX IF NOT EXISTS idx_job_alerts_company_slug ON job_alerts(company_slug);

class AlertsDao extends PostgresDao {
  constructor() {
    super('job_alerts');
  }

  async createAlert({ userId, alertType = 'company', companySlug, companyName, companyLogoUrl, metadata = {} }) {
    return this.getQ({
      sql: `
        INSERT INTO job_alerts (user_id, alert_type, company_slug, company_name, company_logo_url, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, alert_type, company_slug) DO NOTHING
        RETURNING *
      `,
      values: [userId, alertType, companySlug ?? null, companyName ?? null, companyLogoUrl ?? null, JSON.stringify(metadata)],
      firstResultOnly: true,
    });
  }

  async deleteAlert({ id, userId }) {
    return this.getQ({
      sql: `DELETE FROM job_alerts WHERE id = $1 AND user_id = $2 RETURNING id`,
      values: [id, userId],
      firstResultOnly: true,
    });
  }

  async getByUser(userId) {
    return this.getQ({
      sql: `SELECT * FROM job_alerts WHERE user_id = $1 ORDER BY created_at DESC`,
      values: [userId],
    });
  }

  async checkAlert({ userId, alertType, companySlug }) {
    return this.getQ({
      sql: `
        SELECT id FROM job_alerts
        WHERE user_id = $1 AND alert_type = $2 AND company_slug = $3
        LIMIT 1
      `,
      values: [userId, alertType, companySlug],
      firstResultOnly: true,
    });
  }
}

export const alertsDao = new AlertsDao();
