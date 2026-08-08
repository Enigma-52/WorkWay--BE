import { defaultPgDao } from '../dao/dao.js';
import { companyDao } from '../dao/companyDao.js';
import { skillsDao } from '../dao/skillsDao.js';
import { filtersDao } from '../dao/filterDao.js';
import { jobsDao } from '../dao/jobsDao.js';

// Every ingestion cron writes to `jobs`/`companies`, which is exactly the
// data these 24h in-memory caches are derived from. Clear them all after any
// cron completes so the next request gets fresh data immediately instead of
// waiting out the full 24h TTL (the TTL still exists as a safety net in case
// this hook is ever missed).
function clearIngestionCaches() {
  companyDao.clearCache();
  skillsDao.clearCache();
  filtersDao.clearCache();
  jobsDao.clearCache();
}

/**
 * Generic cron job runner with DB tracking and dry run support.
 *
 * @param {string}   tag     - Unique label for the job (e.g. 'daily_greenhouse')
 * @param {Function} fn      - Async function to execute
 * @param {boolean}  dryRun  - If true, record the trigger but skip execution
 */
export async function runCronJob({ tag, fn, dryRun = false, force = false }) {
  const startedAt = new Date();

  // Check if this job is enabled (skip check if forced via manual trigger)
  if (!force) {
    const config = await defaultPgDao.getQ({
      sql: `SELECT enabled FROM cron_config WHERE tag = $1 LIMIT 1`,
      values: [tag],
    });
    // If row exists and enabled is false, skip
    if (config.length > 0 && !config[0].enabled) {
      console.log(`[CRON] ${tag} is disabled, skipping`);
      return { tag, status: 'disabled' };
    }
  }

  // Refuse to start a second overlapping run of the same tag. This was a
  // latent gap even before manual triggering had a UI (only reachable by
  // knowing the raw internal-secret-gated URL); the admin panel's one-click
  // "Run now" button makes rapid double-triggering (a double click, a stuck
  // network retry) practically likely enough to guard against explicitly,
  // not just theoretically possible.
  if (!dryRun) {
    const alreadyRunning = await defaultPgDao.getQ({
      sql: `SELECT id FROM cron_runs WHERE tag = $1 AND status = 'started' AND finished_at IS NULL LIMIT 1`,
      values: [tag],
    });
    if (alreadyRunning.length > 0) {
      console.log(`[CRON] ${tag} is already running (run #${alreadyRunning[0].id}), skipping`);
      return { tag, status: 'already_running', runId: alreadyRunning[0].id };
    }
  }

  // Insert a run record
  const inserted = await defaultPgDao.getQ({
    sql: `INSERT INTO cron_runs (tag, status, dry_run, started_at)
          VALUES ($1, $2, $3, $4)
          RETURNING id`,
    values: [tag, dryRun ? 'dry_run' : 'started', dryRun, startedAt.toISOString()],
  });

  const runId = inserted[0].id;

  if (dryRun) {
    console.log(`[CRON DRY RUN] ${tag} — recorded run #${runId}, skipping execution`);
    return { runId, tag, status: 'dry_run' };
  }

  try {
    const result = await fn();
    const durationMs = Date.now() - startedAt.getTime();

    await defaultPgDao.getQ({
      sql: `UPDATE cron_runs
            SET status = 'completed', finished_at = NOW(), duration_ms = $1, result = $2
            WHERE id = $3`,
      values: [durationMs, JSON.stringify(result || {}), runId],
    });

    clearIngestionCaches();

    console.log(`[CRON] ${tag} completed in ${durationMs}ms (run #${runId})`);
    return { runId, tag, status: 'completed', durationMs, result };
  } catch (err) {
    const durationMs = Date.now() - startedAt.getTime();

    await defaultPgDao.getQ({
      sql: `UPDATE cron_runs
            SET status = 'failed', finished_at = NOW(), duration_ms = $1, error = $2
            WHERE id = $3`,
      values: [durationMs, err.message, runId],
    });

    console.error(`[CRON] ${tag} failed in ${durationMs}ms (run #${runId}):`, err.message);
    return { runId, tag, status: 'failed', durationMs, error: err.message };
  }
}
