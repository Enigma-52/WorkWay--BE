# AGENTS.md

This file gives working context and guardrails for engineers/agents modifying `WorkWay--BE`.

## 1) Repository Purpose
`WorkWay--BE` is a Node.js + Express API service that powers WorkWay job discovery features.

Primary responsibilities:
- Serve job/company/filter/feed APIs for the frontend.
- Generate XML sitemaps.
- Run ingestion endpoints that pull job/company data from Greenhouse and store it in PostgreSQL.

## 2) Runtime and Tooling
- Runtime: Node.js (ESM modules enabled via `"type": "module"`).
- Web server: Express 5.
- DB: PostgreSQL using `pg` connection pool.
- Dev runner: `nodemon`.

Common commands:
- `npm install`
- `npm run dev` (local dev with reload)
- `npm start` (production-style run)

## 3) High-Level Architecture
Flow:
1. `src/server.js` starts Express and initializes PostgreSQL pool (`initPg`).
2. Routes under `src/routes/*` define HTTP endpoints under `/api/*`.
3. Services under `src/services/*` contain business logic and composition.
4. DAO layer (`src/dao/*`) executes SQL and DB CRUD helpers.
5. Utility layer handles parsing/classification helpers, constants, and logging.

Layering expectation:
- Route -> Service -> DAO -> PostgreSQL
- Avoid SQL in routes.
- Keep service methods focused and side-effect aware.

## 4) API Surface (Current)
Mounted at `/api`:
- `/cron/*` ingestion/maintenance endpoints.
- `/company/*` company list/details/overview endpoints.
- `/job/*` job detail endpoint.
- `/feed/*` home feed endpoint with cursor paging.
- `/filter/*` domain filtering endpoints.
- `/sitemap.xml` and `/sitemaps/*.xml` XML sitemap endpoints.

Global endpoints outside `/api`:
- `GET /health`
- `GET /`

## 5) Data Expectations (Inferred)
Primary tables used by app code:
- `companies`
  - fields used: `id`, `name`, `slug`, `logo_url`, `description`, `website`, `location`, `platform`, `namespace`, `created_at`.
- `jobs`
  - fields used: `id`, `company_id`, `company`, `slug`, `platform`, `job_id`, `title`, `url`, `description`, `experience_level`, `employment_type`, `domain`, `location`, `updated_at`, `created_at`.

Important assumptions:
- `companies.slug` is conflict key for upserts.
- `jobs.slug` is conflict key for upserts.
- `jobs.company_id` maps to `companies.id`.
- `jobs.description` may be JSON stringified content.

## 6) Environment Variables
Defined in `src/config.js`:
- `APP_ENV`
- `POSTGRES_DB_HOST`
- `POSTGRES_DB_PORT`
- `POSTGRES_DB_USER`
- `POSTGRES_DB_PASSWORD`
- `POSTGRES_DB_DATABASE`
- `POSTGRES_DB_MAX_CONNECTIONS` (declared but pool currently uses fixed `max: 5`)

## 7) Operational Notes
- PostgreSQL pool enforces SSL and IPv4 (`family: 4`).
- Logger prints IST timestamps.
- No test suite currently exists.
- Cron routes are plain HTTP endpoints (no scheduler/auth layer in repo).

## 8) Known Quirks To Preserve or Fix Deliberately
- `feed/home` expects `options` in query and service treats it as object; in Express query params this may arrive as string if not encoded as nested params.
- `getJobDetails` assumes the queried slug exists (`jobDetails[0]` access).
- Company overview has hardcoded trending company IDs.
- Some route handlers have minimal error handling and may throw uncaught errors.

If changing any of the above, update docs and verify frontend contracts.

## 9) Documentation Rule for This Repo
When making non-trivial backend changes:
- Update `README.md` if setup/API behavior changed.
- Update `docs/DETAILED_DOCS.md` for architecture/data contract changes.
- Add migration notes if schema assumptions changed.
