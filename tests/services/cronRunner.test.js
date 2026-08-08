import { describe, it, expect, vi, beforeEach } from 'vitest';

// cronRunner touches several caches on completion — stub them all so this
// stays a pure test of the runner's own state machine.
vi.mock('../../src/dao/companyDao.js', () => ({ companyDao: { clearCache: vi.fn() } }));
vi.mock('../../src/dao/skillsDao.js', () => ({ skillsDao: { clearCache: vi.fn() } }));
vi.mock('../../src/dao/filterDao.js', () => ({ filtersDao: { clearCache: vi.fn() } }));
vi.mock('../../src/dao/jobsDao.js', () => ({ jobsDao: { clearCache: vi.fn() } }));

vi.mock('../../src/dao/dao.js', () => ({
  defaultPgDao: { getQ: vi.fn() },
}));

const { defaultPgDao } = await import('../../src/dao/dao.js');
const { runCronJob } = await import('../../src/services/cronRunner.js');

// In-memory fake of the two tables runCronJob actually touches, keyed by
// matching against the SQL text — realistic enough to exercise the runner's
// actual branching without a live DB.
function makeFakeCronRunsTable() {
  let nextId = 1;
  const rows = [];
  return {
    rows,
    handler: async ({ sql, values }) => {
      if (sql.includes('SELECT id FROM cron_runs WHERE tag')) {
        return rows.filter((r) => r.tag === values[0] && r.status === 'started' && !r.finished_at);
      }
      if (sql.includes('INSERT INTO cron_runs')) {
        const row = { id: nextId++, tag: values[0], status: values[1], dry_run: values[2], finished_at: null };
        rows.push(row);
        return [{ id: row.id }];
      }
      if (sql.includes('UPDATE cron_runs')) {
        const id = values[values.length - 1];
        const row = rows.find((r) => r.id === id);
        if (row) {
          row.status = sql.includes("status = 'completed'") ? 'completed' : 'failed';
          row.finished_at = new Date();
        }
        return [];
      }
      return [];
    },
  };
}

let fakeTable;
let cronConfig;

beforeEach(() => {
  fakeTable = makeFakeCronRunsTable();
  cronConfig = new Map(); // tag -> enabled
  defaultPgDao.getQ.mockImplementation(async ({ sql, values }) => {
    if (sql.includes('SELECT enabled FROM cron_config')) {
      const enabled = cronConfig.get(values[0]);
      return enabled === undefined ? [] : [{ enabled }];
    }
    return fakeTable.handler({ sql, values });
  });
});

describe('runCronJob — enable/disable', () => {
  it('skips a job explicitly disabled in cron_config', async () => {
    cronConfig.set('some_job', false);
    const fn = vi.fn();
    const result = await runCronJob({ tag: 'some_job', fn });
    expect(result.status).toBe('disabled');
    expect(fn).not.toHaveBeenCalled();
  });

  it('runs a job with no cron_config row (implicit-enabled fallback)', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true });
    const result = await runCronJob({ tag: 'brand_new_job', fn });
    expect(result.status).toBe('completed');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('force:true bypasses a disabled flag', async () => {
    cronConfig.set('some_job', false);
    const fn = vi.fn().mockResolvedValue({});
    const result = await runCronJob({ tag: 'some_job', fn, force: true });
    expect(result.status).toBe('completed');
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('runCronJob — execution outcomes', () => {
  it('records a completed run with its result payload', async () => {
    const fn = vi.fn().mockResolvedValue({ sent: 3, checked: 10 });
    const result = await runCronJob({ tag: 'job_a', fn, force: true });
    expect(result.status).toBe('completed');
    expect(result.result).toEqual({ sent: 3, checked: 10 });
    expect(typeof result.runId).toBe('number');
  });

  it('records a failed run with the error message, not a throw', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('ingestion exploded'));
    const result = await runCronJob({ tag: 'job_b', fn, force: true });
    expect(result.status).toBe('failed');
    expect(result.error).toBe('ingestion exploded');
  });

  it('a dry run records the trigger but never calls fn', async () => {
    const fn = vi.fn();
    const result = await runCronJob({ tag: 'job_c', fn, dryRun: true, force: true });
    expect(result.status).toBe('dry_run');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('runCronJob — re-entrancy guard', () => {
  it('refuses to start a second run of the same tag while one is in flight', async () => {
    let resolveFirst;
    const slowFn = () => new Promise((resolve) => { resolveFirst = resolve; });

    const firstPromise = runCronJob({ tag: 'overlap_job', fn: slowFn, force: true });
    // Let the first insert land before firing the second.
    await new Promise((r) => setTimeout(r, 0));

    const second = await runCronJob({ tag: 'overlap_job', fn: vi.fn(), force: true });
    expect(second.status).toBe('already_running');

    resolveFirst({ ok: true });
    const first = await firstPromise;
    expect(first.status).toBe('completed');
  });

  it('allows a new run of the same tag once the previous one has finished', async () => {
    await runCronJob({ tag: 'sequential_job', fn: vi.fn().mockResolvedValue({}), force: true });
    const second = await runCronJob({ tag: 'sequential_job', fn: vi.fn().mockResolvedValue({}), force: true });
    expect(second.status).toBe('completed');
  });

  it('does not apply the overlap guard to dry runs', async () => {
    const first = await runCronJob({ tag: 'dry_job', fn: vi.fn(), dryRun: true, force: true });
    const second = await runCronJob({ tag: 'dry_job', fn: vi.fn(), dryRun: true, force: true });
    expect(first.status).toBe('dry_run');
    expect(second.status).toBe('dry_run');
  });

  it('a failed run releases the lock for the next trigger', async () => {
    await runCronJob({ tag: 'flaky_job', fn: vi.fn().mockRejectedValue(new Error('boom')), force: true });
    const second = await runCronJob({ tag: 'flaky_job', fn: vi.fn().mockResolvedValue({}), force: true });
    expect(second.status).toBe('completed');
  });
});
