import PostgresDao from './dao.js';

// Migration SQL (run once):
//
// CREATE TABLE IF NOT EXISTS company_alert_checkpoint (
//   id           SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- single row, enforced
//   last_job_id  BIGINT NOT NULL DEFAULT 0,
//   updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
// -- Seed to the current max job id so shipping this doesn't email every
// -- follower about every job ever posted.
// INSERT INTO company_alert_checkpoint (id, last_job_id)
// VALUES (1, (SELECT COALESCE(MAX(id), 0) FROM jobs))
// ON CONFLICT (id) DO NOTHING;

class AlertCheckpointDao extends PostgresDao {
  constructor() {
    super('company_alert_checkpoint');
  }

  async get() {
    const row = await this.getQ({
      sql: `SELECT last_job_id FROM company_alert_checkpoint WHERE id = 1`,
      firstResultOnly: true,
    });
    return row ? Number(row.last_job_id) : 0;
  }

  // Only moves forward — a run that somehow saw a smaller max id than what's
  // already recorded (shouldn't happen, but cheap to guard) can't rewind it.
  async advance(lastJobId) {
    return this.getQ({
      sql: `
        UPDATE company_alert_checkpoint
        SET last_job_id = $1, updated_at = now()
        WHERE id = 1 AND last_job_id < $1
        RETURNING last_job_id
      `,
      values: [lastJobId],
      firstResultOnly: true,
    });
  }
}

export const alertCheckpointDao = new AlertCheckpointDao();
