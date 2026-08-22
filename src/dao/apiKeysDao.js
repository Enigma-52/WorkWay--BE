import PostgresDao from './dao.js';

// Migration SQL (run once):
//
// CREATE TABLE IF NOT EXISTS api_keys (
//   id           SERIAL PRIMARY KEY,
//   user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- users.id is uuid
//   name         TEXT NOT NULL,
//   key_hash     TEXT NOT NULL UNIQUE,   -- sha256 of the raw key; raw is never stored
//   key_prefix   TEXT NOT NULL,          -- first chars, shown in UI for identification
//   last_used_at TIMESTAMPTZ,
//   usage_count  INTEGER NOT NULL DEFAULT 0,
//   expires_at   TIMESTAMPTZ,            -- NULL = never expires
//   revoked_at   TIMESTAMPTZ,
//   created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
// CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
// CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

class ApiKeysDao extends PostgresDao {
  constructor() {
    super('api_keys');
  }

  async create({ userId, name, keyHash, keyPrefix, expiresAt = null }) {
    return this.getQ({
      sql: `
        INSERT INTO api_keys (user_id, name, key_hash, key_prefix, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, key_prefix, expires_at, created_at
      `,
      values: [userId, name, keyHash, keyPrefix, expiresAt],
      firstResultOnly: true,
    });
  }

  // Joins users so auth resolves the key and loads the owner (plan_key included,
  // which the Pro-messaging path needs) in a single round trip.
  async findByHash(keyHash) {
    return this.getQ({
      sql: `
        SELECT k.id, k.user_id, k.expires_at, k.revoked_at,
               u.id AS owner_id, u.email, u.plan_key
        FROM api_keys k
        JOIN users u ON u.id = k.user_id
        WHERE k.key_hash = $1
        LIMIT 1
      `,
      values: [keyHash],
      firstResultOnly: true,
    });
  }

  async listByUser(userId) {
    return this.getQ({
      sql: `
        SELECT id, name, key_prefix, last_used_at, usage_count,
               expires_at, revoked_at, created_at
        FROM api_keys
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      values: [userId],
    });
  }

  async revoke({ id, userId }) {
    return this.getQ({
      sql: `
        UPDATE api_keys SET revoked_at = NOW()
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        RETURNING id
      `,
      values: [id, userId],
      firstResultOnly: true,
    });
  }

  async touchLastUsed(id) {
    return this.updateQ({
      sql: `UPDATE api_keys SET last_used_at = NOW(), usage_count = usage_count + 1 WHERE id = $1`,
      values: [id],
    });
  }
}

export const apiKeysDao = new ApiKeysDao();
