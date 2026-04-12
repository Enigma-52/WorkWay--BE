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
    updated_at
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
      values: [[role], displayName, email],
      firstResultOnly: true,
    });
  }
}

export const usersDao = new UsersDao();
