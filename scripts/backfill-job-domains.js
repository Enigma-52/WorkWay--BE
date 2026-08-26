/**
 * One-off backfill: recompute `jobs.domain` for every row using the real,
 * current `getJobDomain()` from src/utils/helper.js — the exact same
 * function future ingestion uses, so there is zero risk of the backfilled
 * values drifting from what new jobs get classified as.
 *
 * Every computed domain is validated against JOB_DOMAINS (constants.js)
 * before anything is written — if getJobDomain() ever returns a string not
 * in that list, the whole run aborts before touching the DB.
 *
 * Run once, from repo root:
 *   node scripts/backfill-job-domains.js
 *
 * Connects via the same POSTGRES_DB config / getPgPool() the app itself
 * uses (see src/utils/initializers/postgres.js) — whatever DB the app's
 * own .env points at.
 */
import { initPg, getPgPool, closePg } from '../src/utils/initializers/postgres.js';
import { getJobDomain } from '../src/utils/helper.js';
import { JOB_DOMAINS } from '../src/utils/constants.js';

const VALID_DOMAINS = new Set(JOB_DOMAINS.map((d) => d.name));
const BATCH_SIZE = 2000;

async function main() {
  await initPg();
  const db = getPgPool();

  console.log('Fetching all jobs (id, title, domain)...');
  const { rows } = await db.query('SELECT id, title, domain FROM jobs');
  console.log(`Fetched ${rows.length} jobs.`);

  const changes = [];
  const transitionCounts = new Map(); // "oldDomain -> newDomain" : count
  const invalid = [];

  for (const row of rows) {
    const newDomain = await getJobDomain(row.title);
    if (!VALID_DOMAINS.has(newDomain)) {
      invalid.push({ id: row.id, title: row.title, newDomain });
      continue;
    }
    if (newDomain !== row.domain) {
      changes.push({ id: row.id, newDomain });
      const key = `${row.domain} -> ${newDomain}`;
      transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
    }
  }

  if (invalid.length > 0) {
    console.error(`ABORTING: ${invalid.length} titles produced a domain not in JOB_DOMAINS. Examples:`);
    for (const inv of invalid.slice(0, 10)) {
      console.error(`  id=${inv.id} title="${inv.title}" -> "${inv.newDomain}"`);
    }
    await closePg();
    process.exit(1);
  }

  console.log(`\n${changes.length} of ${rows.length} jobs will be reclassified.\n`);
  console.log('=== Transition breakdown (old -> new), top 40 ===');
  const sortedTransitions = [...transitionCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [transition, count] of sortedTransitions.slice(0, 40)) {
    console.log(`  ${String(count).padStart(7)}  ${transition}`);
  }
  if (sortedTransitions.length > 40) {
    console.log(`  ... and ${sortedTransitions.length - 40} more transition types`);
  }

  if (changes.length === 0) {
    console.log('Nothing to update.');
    await closePg();
    return;
  }

  console.log(`\nApplying ${changes.length} updates in batches of ${BATCH_SIZE}, inside one transaction...`);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let applied = 0;
    for (let i = 0; i < changes.length; i += BATCH_SIZE) {
      const batch = changes.slice(i, i + BATCH_SIZE);
      const ids = batch.map((c) => c.id);
      const domains = batch.map((c) => c.newDomain);
      const result = await client.query(
        `UPDATE jobs
         SET domain = data.domain
         FROM (SELECT unnest($1::bigint[]) AS id, unnest($2::text[]) AS domain) AS data
         WHERE jobs.id = data.id`,
        [ids, domains]
      );
      applied += result.rowCount;
      process.stdout.write(`\r  ${applied}/${changes.length} rows updated`);
    }
    await client.query('COMMIT');
    console.log(`\n\nCommitted. ${applied} rows updated.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nError during update, rolled back everything:', err);
    throw err;
  } finally {
    client.release();
  }

  await closePg();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
