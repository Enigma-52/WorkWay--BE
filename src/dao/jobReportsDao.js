import PostgresDao from './dao.js';

const AUTO_DEACTIVATE_THRESHOLD = 3;

class JobReportsDao extends PostgresDao {
  constructor() {
    super('job_reports');
  }

  // Returns null if this IP already reported this job (unique constraint), otherwise the new report row.
  async create({ jobId, reason, details, reporterIp, userId }) {
    return this.getQ({
      sql: `
        INSERT INTO job_reports (job_id, reason, details, reporter_ip, user_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (job_id, reporter_ip) DO NOTHING
        RETURNING *
      `,
      values: [jobId, reason, details ?? null, reporterIp ?? null, userId ?? null],
      firstResultOnly: true,
    });
  }

  async countForJob(jobId) {
    const row = await this.getQ({
      sql: `SELECT COUNT(*)::int AS count FROM job_reports WHERE job_id = $1`,
      values: [jobId],
      firstResultOnly: true,
    });
    return row?.count ?? 0;
  }

  // Deactivates the job once report count crosses the threshold. Returns true if it just flipped.
  async maybeDeactivate(jobId) {
    const count = await this.countForJob(jobId);
    if (count < AUTO_DEACTIVATE_THRESHOLD) return false;

    const result = await this.getQ({
      sql: `UPDATE jobs SET is_active = false WHERE id = $1 AND is_active = true RETURNING id`,
      values: [jobId],
      firstResultOnly: true,
    });
    return !!result;
  }
}

export const jobReportsDao = new JobReportsDao();
