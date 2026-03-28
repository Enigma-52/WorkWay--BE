// src/dao/magicLinksDao.js
import PostgresDao from './dao.js';

const INSERT_MAGIC_LINK_SQL = `
  INSERT INTO magic_links (email, token_hash, expires_at, ip_address, user_agent)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING id
`;

const FIND_BY_HASH_SQL = `
  SELECT id, email, token_hash, expires_at, used_at
  FROM magic_links
  WHERE token_hash = $1
  LIMIT 1
`;

const MARK_USED_SQL = `
  UPDATE magic_links
  SET used_at = now()
  WHERE id = $1
`;

class MagicLinksDao extends PostgresDao {
  constructor() {
    super('magic_links');
  }

  async insert({ email, tokenHash, expiresAt, ipAddress, userAgent }) {
    return this.getQ({
      sql: INSERT_MAGIC_LINK_SQL,
      values: [email, tokenHash, expiresAt, ipAddress ?? null, userAgent ?? null],
      firstResultOnly: true,
    });
  }

  async findByHash(tokenHash) {
    return this.getQ({
      sql: FIND_BY_HASH_SQL,
      values: [tokenHash],
      firstResultOnly: true,
    });
  }

  async markUsed(id) {
    return this.updateQ({
      sql: MARK_USED_SQL,
      values: [id],
    });
  }
}

export const magicLinksDao = new MagicLinksDao();
