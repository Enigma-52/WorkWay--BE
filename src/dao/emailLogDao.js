import PostgresDao from './dao.js';

// Migration SQL (run once):
//
// ALTER TABLE email_log ADD COLUMN IF NOT EXISTS reference_id TEXT;
// CREATE INDEX IF NOT EXISTS idx_email_log_user_type_ref
//   ON email_log(user_id, email_type, reference_id);
//
// -- A row previously only proved "Resend's API accepted this call" — it
// -- didn't capture Resend's own message id, so there was no way to look up
// -- what actually happened to a send (delivered / bounced / spam complaint)
// -- and failed sends were never recorded at all (only logged to Winston).
// ALTER TABLE email_log ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
// ALTER TABLE email_log ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'sent';
// ALTER TABLE email_log ADD COLUMN IF NOT EXISTS error TEXT;
// ALTER TABLE email_log ADD COLUMN IF NOT EXISTS recipient TEXT;
// CREATE INDEX IF NOT EXISTS idx_email_log_provider_message_id ON email_log(provider_message_id);

class EmailLogDao extends PostgresDao {
  constructor() {
    super('email_log');
  }

  // status: 'sent' (Resend accepted it — the default), 'failed' (Resend's
  // API rejected it, e.g. bad address or over quota), later updated to
  // 'delivered' / 'bounced' / 'complained' by the Resend webhook as those
  // events arrive.
  async log({ userId, emailType, isTest = false, referenceId = null, providerMessageId = null, status = 'sent', error = null, recipient = null }) {
    return this.getQ({
      sql: `
        INSERT INTO email_log (user_id, email_type, is_test, reference_id, provider_message_id, status, error, recipient)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      values: [userId, emailType, isTest, referenceId, providerMessageId, status, error, recipient],
      firstResultOnly: true,
    });
  }

  // Called by the Resend webhook as delivery/bounce/complaint events arrive
  // for a message id we captured at send time.
  async markStatusByProviderMessageId(providerMessageId, status) {
    return this.getQ({
      sql: `UPDATE email_log SET status = $2 WHERE provider_message_id = $1 RETURNING *`,
      values: [providerMessageId, status],
    });
  }

  // Per-job dedup for the company-alert digest: has this user already been
  // emailed about this specific job? `referenceId` is the job id as text —
  // other email types never set it, so this only ever matches company_alert rows.
  // Excludes 'failed' rows on purpose — a Resend rejection shouldn't
  // permanently block a job from ever being retried on the next cron run.
  async hasSent({ userId, emailType, referenceId }) {
    const row = await this.getQ({
      sql: `SELECT 1 FROM email_log WHERE user_id = $1 AND email_type = $2 AND reference_id = $3 AND status != 'failed' LIMIT 1`,
      values: [userId, emailType, referenceId],
      firstResultOnly: true,
    });
    return !!row;
  }

  // Backs the dashboard "Alerts" tab: exactly what this user has actually
  // been emailed about, not a fresh re-computation that could drift from it.
  // Scoped to today only — the "Companies" page already shows older postings
  // from followed companies, so this tab stays a same-day digest rather than
  // duplicating that history.
  async getCompanyAlertJobsForUser(userId, limit = 30) {
    return this.getQ({
      sql: `
        SELECT j.slug, j.title, j.location, j.employment_type,
               c.name AS company_name, c.slug AS company_slug, c.logo_url AS company_logo_url,
               el.sent_at
        FROM email_log el
        JOIN jobs j ON j.id::text = el.reference_id
        JOIN companies c ON c.id = j.company_id
        WHERE el.user_id = $1 AND el.email_type = 'company_alert' AND el.is_test = false
          AND el.status != 'failed'
          AND el.sent_at >= date_trunc('day', now())
        ORDER BY el.sent_at DESC
        LIMIT $2
      `,
      values: [userId, limit],
    });
  }
}

export const emailLogDao = new EmailLogDao();
