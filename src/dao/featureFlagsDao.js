import PostgresDao from './dao.js';

const CACHE_TTL_MS = 30 * 1000;
const cache = new Map(); // flag_key -> { enabled, expiresAt }

class FeatureFlagsDao extends PostgresDao {
  constructor() {
    super('feature_flags');
  }

  async isEnabled(key) {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.enabled;

    const row = await this.getQ({
      sql: `SELECT enabled FROM feature_flags WHERE flag_key = $1`,
      values: [key],
      firstResultOnly: true,
    });
    const enabled = row?.enabled ?? false;
    cache.set(key, { enabled, expiresAt: Date.now() + CACHE_TTL_MS });
    return enabled;
  }

  async getAll() {
    return this.getQ({ sql: `SELECT flag_key, enabled, description, updated_at FROM feature_flags ORDER BY flag_key` });
  }

  async setEnabled(key, enabled) {
    const row = await this.getQ({
      sql: `UPDATE feature_flags SET enabled = $1, updated_at = now() WHERE flag_key = $2 RETURNING flag_key, enabled, description, updated_at`,
      values: [enabled, key],
      firstResultOnly: true,
    });
    cache.delete(key);
    return row;
  }
}

export const featureFlagsDao = new FeatureFlagsDao();
