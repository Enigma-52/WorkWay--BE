# MCP smoke test

Manual end-to-end verification of the MCP server against a running backend.
Last run: 2026-08-22, all checks passing.

## Prerequisites

Apply the `api_keys` DDL from `src/dao/apiKeysDao.js` first. Note `user_id` is
**UUID**, not INTEGER — `users.id` is a uuid column (the `INTEGER` in older DAO
migration comments, e.g. `alertsDao.js`, is stale and does not match the live
schema).

Boot the server with `npm run dev`, then mint a key:

```bash
curl -s -X POST http://localhost:3000/api/api-keys \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"<UUID>","name":"local smoke"}'
```

`raw_key` in the response is shown once and never again.

## Checks

| # | Check | Result |
|---|---|---|
| 1 | `POST /api/mcp` with no `Authorization` header | 401, message points at `workway.dev/dashboard/seeker/api-keys` |
| 2 | `tools/list` with a valid key | all 9 tools returned with correct JSON schemas |
| 3 | `search_jobs` | live results, `apply_url` (ATS) + `workway_url` + CTA all present |
| 4 | `search_jobs` with `platform: "ashby"` | filtered to ashby postings |
| 5 | `search_jobs` with `platform: "monster"` | rejected by the zod enum before reaching the service |
| 6 | `list_domains` | domains with `job_count` populated |
| 7 | `get_company_overview` (`stripe`) | 1,626 open roles, domain breakdown, recent jobs |
| 8 | `get_company_overview` (unknown) | clear error pointing at `/companies` |
| 9 | `follow_company` as **free** user | **succeeded** + told instant email alerts are Pro |
| 10 | `follow_company` as **pro** user | succeeded, plain confirmation, no upsell |
| 11 | `follow_company` twice | idempotent, "already following" |
| 12 | `list_alerts` | `email_alerts_active` false for free, true for pro |
| 13 | `save_job` / bad slug / `list_saved_jobs` | saves, errors clearly, lists with both links |
| 14 | `update_talent_profile` create + partial update | creates with username, patches only supplied fields |
| 15 | `get_talent_profile` | returns profile, JSONB `skills` round-trips as an array |
| 16 | Usage tracking | `usage_count` incremented per call, `last_used_at` set |
| 17 | Revoke then reuse | 401, "That WorkWay API key has been revoked." |

## Schema mismatches found and fixed during this run

These were wrong in the first implementation because the column names were
assumed rather than read:

- `users.id` is `uuid`, not `integer` — the `api_keys` FK had to match.
- `getJobsPerDomain()` aliases its count as `job_count`, not `count`.
- `saved_jobs` timestamps rows as `saved_at`, not `created_at`.
- `talent_profiles` uses `professional_title` / `about` / `country`, not
  `headline` / `bio` / `location`, and has no `website_url`/`github_url`
  columns — social links live in a `social_links` JSONB column.
- The public profile URL is `/p/{username}` (per `generateTalentsSitemap`),
  and the dashboard editor is at `/dashboard/seeker/talent-profile`.

## Cleanup

All rows created by this run (2 api_keys, 1 talent_profile, 2 job_alerts,
1 saved_job) were deleted afterwards. Pre-existing follows were left alone.
