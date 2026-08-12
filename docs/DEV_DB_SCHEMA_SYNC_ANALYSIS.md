# Dev Postgres / schema consistency — analysis

Notes from evaluating how to get a smaller, dedicated dev Postgres instance
whose schema stays in sync with prod, instead of developing against the
prod database directly.

## Current state

- Local dev currently connects to the prod database. Workable while the
  project is small, but not a long-term setup.
- There is no migration framework. Per
  `WorkWay-FE-Next/docs/DEPLOYMENT.md`, each DAO file that introduced a
  table carries its `CREATE TABLE` DDL as a `Migration SQL (run once)`
  comment at the top of the file, applied by hand against the live DB when
  the feature shipped. Tables following this pattern: `job_alerts`,
  `job_reports`, `email_log` (plus a later `reference_id` column, also
  documented inline), `company_alert_checkpoint`, `feature_flags`, `plans`,
  `subscriptions`, `dodo_webhook_events`, `cron_config`, `cron_runs`,
  `talent_profiles` and its child tables (experiences/education/
  certifications), `saved_jobs`, `applications` — plus the original
  bootstrap tables (`users`, `companies`, `jobs`).
- Two seed rows also need inserting by hand on a fresh DB
  (`company_alert_checkpoint`, `feature_flags` — both idempotent,
  `ON CONFLICT DO NOTHING`). `cron_config` rows are seeded automatically at
  boot via `ensureCronConfigRows()`.
- Backend DB access is the raw `pg` driver — no ORM/query builder in the
  dependency tree, so there's nothing pre-existing to build migrations on
  top of.

## Root cause

There's no single source of truth for the schema other than "whatever is
currently applied to prod Postgres." A dev database can only ever be a
snapshot of that at some point in time, and will drift the moment someone
hand-applies a new DDL comment to prod without updating dev the same way.

## Options considered

**Schema mirror (no new tool)** — periodically `pg_dump --schema-only` prod
and restore into a local dev Postgres:
```
pg_dump -h <droplet via SSH tunnel> -U postgres -d postgres --schema-only --no-owner > schema.sql
psql -h localhost -U postgres -d postgres < schema.sql
```
Fast to set up, keeps dev matching prod at the moment it's run, but stays
manual and doesn't address the underlying gap — it mirrors the current
problem rather than fixing it.

**Adopt a migration tool (real fix)** — given the raw `pg` driver with no
ORM to marry, `node-pg-migrate` fits: plain SQL/JS migration files, runs
against any Postgres via a connection string, no framework lock-in.
Path: convert each existing "Migration SQL (run once)" comment into one
numbered migration file, in the dependency order already documented
(`users` → `companies`/`jobs` → everything else); run `node-pg-migrate up`
once against prod to record those as already-applied (fake/seed the
migrations table, since the DDL already exists there); from then on every
schema change is a new migration file run against dev locally and prod at
deploy, keeping both in sync by construction.

## Decision

Two-phase: use the schema-only dump/restore to stand up a smaller dev
Postgres now and unblock day-to-day work, and treat adopting
`node-pg-migrate` as the actual fix — a separate, larger piece of work
touching every DAO file, to be picked up when back in this repo rather than
as part of the infra/secrets pass.
