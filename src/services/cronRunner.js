import { defaultPgDao } from '../dao/dao.js';

/**
 * Generic cron job runner with DB tracking and dry run support.
 *
 * @param {string}   tag     - Unique label for the job (e.g. 'daily_greenhouse')
 * @param {Function} fn      - Async function to execute
 * @param {boolean}  dryRun  - If true, record the trigger but skip execution
 */
export async function runCronJob({ tag, fn, dryRun = false }) {
  const startedAt = new Date();

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
