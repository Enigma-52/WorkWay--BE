import { Pool } from 'pg';
import { POSTGRES_DB } from '../../config.js'; // adjust path if needed

let pool = null;

/**
 * Initialize PostgreSQL connection pool
 * Call once during app startup
 */
export async function initPg() {
  if (pool) return pool;

  pool = new Pool({
    user: POSTGRES_DB.USER,
    host: POSTGRES_DB.HOST, // *.pooler.supabase.com
    database: POSTGRES_DB.DATABASE,
    password: POSTGRES_DB.PASSWORD,
    port: POSTGRES_DB.PORT, // usually 5432 or 6543
    max: 5, // IMPORTANT: keep small for pooler
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: false },

    // CRITICAL for PgBouncer:
    statement_timeout: 0,
    query_timeout: 0,
    keepAlive: true,
    // Disable prepared statements:
    prepareThreshold: 0,
  });

  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }

  return pool;
}

/**
 * Get a PostgreSQL client
 * Caller MUST release()
 */
export function getPgPool() {
  if (!pool) {
    throw new Error('Postgres not initialized. Call initPg() first.');
  }
  return pool;
}

/**
 * Health check for PostgreSQL
 */
export async function pgHealthCheck() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Gracefully close PostgreSQL pool
 */
export async function closePg() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[POSTGRES] Pool closed');
  }
}
