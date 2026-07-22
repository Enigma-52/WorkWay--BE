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
    host: POSTGRES_DB.HOST, // db.xxxxx.supabase.co
    database: POSTGRES_DB.DATABASE,
    password: POSTGRES_DB.PASSWORD,
    port: POSTGRES_DB.PORT, // 5432

    ssl: { rejectUnauthorized: false },

    // 5 was too small: a single unfiltered /jobs request alone fans out to
    // 4-5 concurrent queries (list + count + 3 facet queries), so even 2
    // simultaneous visitors could exhaust the whole pool and queue every
    // other request behind them. Verify this against your Postgres
    // provider's own max_connections limit if you have multiple app
    // instances sharing the same database.
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,

    family: 4, // 🔴 force IPv4 on Render
  });

  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    await client.query('CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs (company_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_jobs_skills_gin ON jobs USING GIN (skills)');
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
