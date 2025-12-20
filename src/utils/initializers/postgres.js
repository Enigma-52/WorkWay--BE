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
    user: POSTGRES_DB.USER || 'postgres',
    host: POSTGRES_DB.HOST || 'localhost',
    database: POSTGRES_DB.DATABASE || 'eqhqdb',
    password: POSTGRES_DB.PASSWORD,
    port: POSTGRES_DB.PORT || 5432,
    max: Number(POSTGRES_DB.POSTGRES_DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: { rejectUnauthorized: false }, // ALWAYS ON for Supabase
  });

  // Fail fast on startup
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
export async function getPgClient() {
  if (!pool) {
    throw new Error('Postgres not initialized. Call initPg() first.');
  }
  return pool.connect();
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
