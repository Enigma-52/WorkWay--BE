import PostgresDao from './dao.js';

const UPSERT_USER_SQL = `
  INSERT INTO users (
    email,
    email_verified,
    display_name,
    first_name,
    last_name,
    avatar_url
  )
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (email) DO UPDATE SET
    email_verified = EXCLUDED.email_verified,
    display_name   = EXCLUDED.display_name,
    first_name     = EXCLUDED.first_name,
    last_name      = EXCLUDED.last_name,
    avatar_url     = EXCLUDED.avatar_url,
    updated_at     = now()
  RETURNING
    id,
    email,
    email_verified,
    display_name,
    first_name,
    last_name,
    avatar_url,
    roles,
    created_at,
    updated_at,
    (xmax = 0) AS is_new
`;

const GET_BY_EMAIL_SQL = `
  SELECT
    id,
    email,
    email_verified,
    display_name,
    first_name,
    last_name,
    avatar_url,
    roles,
    created_at,
    updated_at
  FROM users
  WHERE email = $1
  LIMIT 1
`;

class UsersDao extends PostgresDao {
  constructor() {
    super('users');
  }

  async upsertUser({ email, emailVerified, displayName, firstName, lastName, avatarUrl }) {
    return this.getQ({
      sql: UPSERT_USER_SQL,
      values: [email, emailVerified, displayName, firstName, lastName, avatarUrl],
      firstResultOnly: true,
    });
  }

  async getByEmail(email) {
    return this.getQ({
      sql: GET_BY_EMAIL_SQL,
      values: [email],
      firstResultOnly: true,
    });
  }

  async getById(id) {
    return this.getQ({
      sql: `SELECT id, email, email_verified, display_name, first_name, last_name,
                   avatar_url, roles, emails_opted_out, created_at, updated_at
            FROM users WHERE id = $1`,
      values: [id],
      firstResultOnly: true,
    });
  }

  async setEmailsOptedOut(userId, optedOut) {
    return this.getQ({
      sql: `UPDATE users SET emails_opted_out = $1, updated_at = now() WHERE id = $2 RETURNING id, emails_opted_out`,
      values: [optedOut, userId],
      firstResultOnly: true,
    });
  }

  // Users eligible for a given lifecycle email: haven't opted out, and don't
  // already have a matching row in email_log within `withinDays` (or ever,
  // for one-time emails like welcome/feedback_7day, when withinDays is null).
  async getUsersDueForEmail({ emailType, withinDays = null, createdBefore = null, createdAfter = null }) {
    const conditions = ['u.emails_opted_out = false'];
    const values = [emailType];
    let paramIndex = 2;

    conditions.push(`NOT EXISTS (
      SELECT 1 FROM email_log el
      WHERE el.user_id = u.id AND el.email_type = $1 AND el.is_test = false
      ${withinDays != null ? `AND el.sent_at > now() - interval '${Number(withinDays)} days'` : ''}
    )`);

    if (createdBefore) {
      conditions.push(`u.created_at <= $${paramIndex++}`);
      values.push(createdBefore);
    }
    if (createdAfter) {
      conditions.push(`u.created_at >= $${paramIndex++}`);
      values.push(createdAfter);
    }

    return this.getQ({
      sql: `SELECT id, email, display_name, first_name, created_at FROM users u WHERE ${conditions.join(' AND ')}`,
      values,
    });
  }

  async updateRoleAndName({ email, role, displayName }) {
    const sql = `
      UPDATE users
      SET roles = $1, display_name = $2, updated_at = now()
      WHERE email = $3
      RETURNING
        id, email, email_verified, display_name,
        first_name, last_name, avatar_url, roles, created_at, updated_at
    `;
    return this.getQ({
      sql,
      values: [JSON.stringify([role]), displayName, email],
      firstResultOnly: true,
    });
  }
}

export const usersDao = new UsersDao();
