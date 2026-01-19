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

    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,

    family: 4, // 🔴 force IPv4 on Render
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
