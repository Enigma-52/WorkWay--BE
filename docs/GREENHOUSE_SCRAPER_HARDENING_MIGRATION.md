# Greenhouse Scraper Hardening Migration Guide

## Purpose
This document describes how to migrate the current Greenhouse ingestion flow to:
- send an explicit `User-Agent` on outbound requests, and
- reduce scraper aggressiveness to lower blocking/rate-limit risk.

This is a runbook/design document only. It does not change runtime behavior by itself.

## Current State (As-Is)
From `src/services/cronService.js`:
- `fetchGreenhouseJobs()` loads all greenhouse companies from DB and processes them with `Promise.all` (full parallel fan-out).
- For each company, job details are fetched in parallel with `Promise.all`.
- `getJobs()` calls `/{company}/jobs` and currently slices the first 2 jobs.
- `getJobDescription()` calls `/{company}/jobs/{jobId}`.
- `insertGreenhouseCompanies()` fetches all namespaces from `src/data/greenhouseCompanies.js` in parallel with `Promise.all`.
- Requests are made with plain `fetch(...)` and no custom request headers.

Risk profile:
- Burst concurrency across companies and jobs can look bot-like.
- No explicit identity header (`User-Agent`) makes traffic easier to classify as generic/anonymous.
- No controlled pacing (delay/jitter/backoff) between requests.

## Target State (To-Be)
Introduce a hardened fetch strategy for Greenhouse endpoints:

1. Request identity
- Set `User-Agent` for all Greenhouse requests.
- Optionally include `From` or `X-Request-Source` headers for traceability.

2. Controlled concurrency
- Limit company-level concurrency (example: 2-5 at a time).
- Limit job-detail concurrency per company (example: 2-4 at a time).
- Avoid unbounded `Promise.all` across the full dataset.

3. Request pacing
- Add a base delay between requests (example: 200-500ms).
- Add random jitter (example: +0-300ms) to avoid synchronized spikes.

4. Failure handling
- Retry transient failures (`429`, `5xx`, network errors) with exponential backoff.
- Respect `Retry-After` response header when present.
- Do not retry hard failures (`400`, `401`, `403`, `404`) more than once.

5. Observability
- Log per-run counters: requested, succeeded, failed, retried, throttled.
- Log status-code distribution for Greenhouse calls.

6. Delta ingestion by external job ID
- Daily run fetches only the job list (`/{company}/jobs`) first.
- Compare feed IDs with DB IDs using stable key `(platform, company_id, job_id)`.
- Fetch full job details only for:
  - new IDs, and
  - existing IDs where source `updated_at` changed.
- Avoid re-fetching details for unchanged jobs.

7. Missing job lifecycle (grace-based soft delete)
- If a DB job ID is missing from current feed, mark as missing (`missing_since` or `missing_runs += 1`).
- Soft-delete only after a grace window (recommended: 2-3 consecutive daily runs).
- Keep URL-level 404 verification optional and limited to borderline cases, not all missing jobs.

## Proposed Config Surface
Use environment variables so runtime behavior can be tuned without code redeploy:

- `GREENHOUSE_USER_AGENT`
- `GREENHOUSE_COMPANY_CONCURRENCY` (default: 3)
- `GREENHOUSE_JOB_CONCURRENCY` (default: 3)
- `GREENHOUSE_REQUEST_DELAY_MS` (default: 250)
- `GREENHOUSE_REQUEST_JITTER_MS` (default: 250)
- `GREENHOUSE_MAX_RETRIES` (default: 3)
- `GREENHOUSE_BACKOFF_BASE_MS` (default: 500)
- `GREENHOUSE_MISSING_GRACE_RUNS` (default: 3)
- `GREENHOUSE_ENABLE_MISSING_URL_VERIFY` (default: false)
- `GREENHOUSE_MISSING_URL_VERIFY_SAMPLE_SIZE` (default: 0; set >0 for selective verification)

Notes:
- Keep safe defaults conservative.
- Validate numeric values on startup and clamp to sane ranges.

## Migration Plan
1. Baseline capture
- Run current cron endpoints in a lower environment.
- Record baseline metrics: total companies, total jobs fetched, total duration, error count, `429` count.

2. Implement transport wrapper
- Centralize Greenhouse HTTP calls behind one helper (for headers, delay, retry, logging).
- Route `getJobs`, `getJobDescription`, and company metadata fetch through this wrapper.

3. Introduce concurrency limiter
- Replace broad `Promise.all` fan-out with bounded workers/pool for:
  - company loop in `fetchGreenhouseJobs()`
  - job loop in each company
  - company seed ingestion in `insertGreenhouseCompanies()`

4. Implement daily delta pipeline (single run)
- Step A: Pull company job lists and build `{job_id, updated_at}` map.
- Step B: Diff against DB records by `(platform, company_id, job_id)`.
- Step C: Fetch detail only for new/changed jobs and upsert those rows.
- Step D: Mark feed-missing DB jobs as `missing` (do not delete immediately).
- Step E: In same run (or cleanup task), soft-delete only if grace window exceeded.

5. Progressive rollout
- Start with low concurrency and higher delays in staging.
- Compare data completeness and run duration vs baseline.
- Tune knobs incrementally.

6. Production rollout
- Deploy with conservative values first.
- Monitor `429`/`403`/timeout rates and total ingest duration.
- Increase throughput only if error rate remains stable.

## Verification Checklist
Functional:
- Same or better successful job ingestion count vs baseline window.
- No schema or payload regressions in stored jobs/companies.
- Unchanged jobs are not re-fetched in detail during normal daily run.
- Missing jobs are soft-deleted only after grace threshold.

Operational:
- Greenhouse request logs always show configured `User-Agent`.
- Lower burstiness in request pattern (fewer simultaneous outbound calls).
- Reduced `429` and transient failure noise over equivalent runs.

Resilience:
- Retries occur only for transient classes.
- Backoff and `Retry-After` are honored.

## Rollback Plan
If ingestion completeness drops materially or runtime becomes unacceptable:
- Set concurrency to prior effective behavior (temporarily raise limits).
- Reduce delay/jitter values.
- Keep `User-Agent` enabled even during rollback.
- Re-run cron and compare counts to last known-good run.

If a fast rollback is required, revert the hardening commit and redeploy previous version.

## Suggested Default Starting Values
For initial production hardening:
- `GREENHOUSE_USER_AGENT=WorkWayBot/1.0 (+backend-ingestion)`
- `GREENHOUSE_COMPANY_CONCURRENCY=3`
- `GREENHOUSE_JOB_CONCURRENCY=2`
- `GREENHOUSE_REQUEST_DELAY_MS=300`
- `GREENHOUSE_REQUEST_JITTER_MS=200`
- `GREENHOUSE_MAX_RETRIES=3`
- `GREENHOUSE_BACKOFF_BASE_MS=500`
- `GREENHOUSE_MISSING_GRACE_RUNS=3`
- `GREENHOUSE_ENABLE_MISSING_URL_VERIFY=false`
- `GREENHOUSE_MISSING_URL_VERIFY_SAMPLE_SIZE=0`

These defaults prioritize stability over ingestion speed.

## Ownership and Follow-Up
- After implementation, update:
  - `README.md` (new env vars and operational notes)
  - `docs/DETAILED_DOCS.md` (ingestion behavior and retry/concurrency model)
- Add a short runbook entry with known-good values per environment.

## Implementation Notes for Current Schema
Current upsert conflict key for jobs is `slug`. For reliable delta sync, align lookups on stable source identity:
- Preferred uniqueness key: `(platform, company_id, job_id)`.
- Keep `slug` for URL use, but do not use it as the only identity key for existence/diff checks.

If schema changes are needed for soft delete/missing tracking, add and document:
- `is_active` boolean default `true`
- `missing_since` timestamp nullable
- `missing_runs` integer default `0`
- `soft_deleted_at` timestamp nullable
