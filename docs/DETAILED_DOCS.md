# WorkWay--BE Detailed Documentation

## 1) Service Overview
`WorkWay--BE` is the backend API for WorkWay. It combines read APIs (job/company discovery) with write-side ingestion (Greenhouse sync) and SEO sitemap generation.

Top-level execution path:
1. `src/server.js` initializes DNS preference (IPv4-first), Express app, and PostgreSQL pool.
2. Router tree is mounted at `/api`.
3. Requests are handled by route modules -> service modules -> DAO modules.

## 2) Boot and Lifecycle
From `src/server.js`:
- Sets DNS resolution order to IPv4 first.
- Parses JSON request bodies with `express.json()`.
- Mounts `src/routes/index.js` at `/api`.
- Exposes `/health` and `/` outside `/api`.
- Calls `initPg()` on startup.
- Handles `SIGTERM` and `SIGINT` for graceful server shutdown.

Note: graceful shutdown currently closes HTTP server but does not explicitly call `closePg()`.

## 3) Route and Endpoint Reference

### 3.1 Company Endpoints
Base: `/api/company`

1. `GET /api/company/details?slug=<company-slug>`
- Service: `getCompanyDetails`.
- Behavior:
  - Fetch company by slug.
  - Fetch all jobs by `company_id`.
  - Return company object enriched with `jobListings`.

2. `GET /api/company`
- Query params:
  - `q` (default empty)
  - `page` (default 1)
  - `limit` (default 20, DAO caps at 50)
  - `letter` (default `ALL`)
  - `hiring` (`true`/`false`, default false)
- Service: `getAllCompanies`.
- Response shape:
  - `meta`: total, page, limit, hasNext
  - `companies`: filtered + sorted list

3. `GET /api/company/overview`
- Service: `getCompanyOverview`.
- Response sections:
  - `stats` (total companies, total jobs)
  - `trending` (hardcoded IDs lookup)
  - `recently_added`
  - `actively_hiring`

### 3.2 Job Endpoint
Base: `/api/job`

1. `GET /api/job/details?slug=<job-slug>`
- Service: `getJobDetails`.
- Behavior:
  - Fetch single job + company joins.
  - Fetch similar jobs by same domain (excluding slug, limit 3).
  - Fetch other jobs by same company (excluding slug, limit 3).
- Returns enriched job payload.

### 3.3 Feed Endpoint
Base: `/api/feed`

1. `GET /api/feed/home`
- Query param currently read as `options`.
- Service: `getHomeJobFeed`.
- Cursor approach:
  - Uses `lastJobId` and `limit`.
  - Fetches `limit + 1` rows to calculate `hasMore`.
  - Returns `{ jobs, nextCursor, hasMore }`.

### 3.4 Filter Endpoints
Base: `/api/filter`

1. `GET /api/filter/domain`
- Query params:
  - `slug` (required for meaningful result)
  - `page` (default 1)
  - `employment_type` (default `all`)
  - `employment_level` (default `all`)
  - `location` (default `all`)
- Service: `getDomainJobDetails`.
- Behavior:
  - Validates domain slug against `JOB_DOMAINS`.
  - Counts total jobs for domain.
  - Fetches filtered page via DAO join.
  - Reduces description to relevant preview snippet.
- Returns:
  - `domain`
  - `jobs`
  - `meta` (page, limit, total, total_pages)

2. `GET /api/filter/domain/all`
- Service: `getAllDomainJobs`.
- Returns grouped job counts per domain with mapped slugs.

### 3.5 Cron/Ingestion Endpoints
Base: `/api/cron`

1. `GET /api/cron/insert_greenhouse`
- Triggers `fetchGreenhouseJobs()`.
- Pulls greenhouse companies from DB where `platform='greenhouse'`.
- For each company:
  - fetch jobs (currently first 5 jobs only),
  - fetch full job description,
  - parse and classify job metadata,
  - upsert into `jobs` table in batches.

2. `GET /api/cron/insert_greenhouse_companies`
- Triggers `insertGreenhouseCompanies()`.
- Uses `src/data/greenhouseCompanies.js` namespaces list.
- Fetches company metadata from Greenhouse board API.
- Deduplicates by slug.
- Upserts into `companies` table.

### 3.6 Sitemap Endpoints
Mounted under `/api` with backwards-compatible routing in index router:

1. `GET /api/sitemap.xml`
- Sitemap index referencing static, companies, domains, jobs sitemaps.

2. `GET /api/sitemaps/static.xml`
- Fixed static pages list.

3. `GET /api/sitemaps/companies.xml`
- Company URLs generated from `companies.slug`.

4. `GET /api/sitemaps/domains.xml`
- Domain URLs generated from constants.

5. `GET /api/sitemaps/jobs.xml`
- Job URLs generated from `jobs.slug`.

## 4) DAO and SQL Layer

### 4.1 Generic DAO (`src/dao/dao.js`)
Capabilities:
- `getQ`, `updateQ`
- `getRow`, `getAllRows`
- `insertOrUpdateMultipleObjs` (bulk upsert with conflict columns)
- `runPgStatement` helper for freeform SQL

Upsert behavior:
- Adds `updated_at = CURRENT_TIMESTAMP` automatically if update set omits it.
- Retries without `updated_at` if column is missing (`42703` handling).

### 4.2 Specialized DAOs
- `jobsDao`: feed queries, single job query, exclusion-based related jobs.
- `companyDao`: paginated list/count and overview blocks.
- `filtersDao`: domain filtering join query and per-domain counts.

## 5) Utility Logic

### 5.1 Classification and Parsing (`src/utils/helper.js`)
- `getJobDomain(title)`: heuristic keyword mapping to canonical domains.
- `getExperienceLevel(title)`: heuristic seniority classifier.
- `getEmploymentType(title)`: contract/part-time/full-time classifier.
- `parseGreenhouseJobDescription(html)`: HTML -> sectioned text.
- `pickRelevantDescriptionSections(description)`: picks best section preview.

### 5.2 Constants (`src/utils/constants.js`)
- `JOB_DOMAINS`: canonical name/slug list used by filter and sitemap services.

### 5.3 Logger (`src/utils/logger.js`)
- Colorized console logger with IST timestamp formatting.

## 6) External Integrations

### 6.1 Greenhouse Boards API
Base used in code:
- `https://boards-api.greenhouse.io/v1/boards/`

Patterns:
- `/{company}/jobs`
- `/{company}/jobs/{jobId}`
- `/{company}`

### 6.2 Logo API
Company ingestion builds logo URL with `img.logo.dev` tokenized format.

## 7) Data Model Notes (Inferred from Queries)

### 7.1 `companies` Table (inferred fields)
- `id` int primary key
- `name` text
- `description` text
- `slug` text unique
- `logo_url` text
- `location` json/jsonb or textified json
- `website` text nullable
- `platform` text
- `namespace` text
- `created_at` timestamp

### 7.2 `jobs` Table (inferred fields)
- `id` int primary key
- `company` text
- `company_id` int FK-like reference
- `slug` text unique
- `platform` text
- `job_id` text/int external id
- `title` text
- `url` text
- `description` text/json
- `experience_level` text
- `employment_type` text
- `domain` text
- `location` text
- `updated_at` timestamp
- `created_at` timestamp

## 8) Config and Environment
From `src/config.js`:
- `APP_ENV` defaults to `dev`
- Postgres env variables with sensible local defaults

Pool config from `src/utils/initializers/postgres.js`:
- SSL enabled (`rejectUnauthorized: false`)
- `family: 4` enforced
- `max: 5` fixed pool size
- idle timeout: 30s
- connection timeout: 10s

## 9) Reliability and Security Gaps
Current repo-level gaps to be aware of:
- Cron endpoints are unauthenticated.
- Minimal input validation in routes.
- Limited defensive checks for missing DB records in some services.
- No automated tests.
- No explicit schema migrations in repository.

## 10) Suggested Near-Term Hardening Backlog
1. Add request validation and consistent error handling middleware.
2. Protect cron endpoints (API key or internal-only network policy).
3. Add not-found handling for slug lookups in company/job services.
4. Add integration tests for route contracts and DAO SQL behavior.
5. Externalize hardcoded values (trending IDs, logo token).
6. Add migration tooling/documented schema source of truth.

## 11) File Map
- `src/server.js`: app bootstrap.
- `src/config.js`: env loading and config objects.
- `src/routes/index.js`: router composition.
- `src/routes/company.js`: company endpoints.
- `src/routes/job.js`: job endpoint.
- `src/routes/feed.js`: home feed endpoint.
- `src/routes/filter.js`: domain filters.
- `src/routes/cron.js`: ingestion triggers.
- `src/routes/sitemap.js`: sitemap endpoints.
- `src/services/companyService.js`: company business logic.
- `src/services/jobService.js`: job details and related jobs.
- `src/services/feedService.js`: cursor feed logic.
- `src/services/filterService.js`: domain filter orchestration.
- `src/services/cronService.js`: Greenhouse fetch + DB upsert logic.
- `src/services/sitemapService.js`: XML generation logic.
- `src/dao/dao.js`: base DAO and upsert helpers.
- `src/dao/companyDao.js`: company SQL queries.
- `src/dao/jobsDao.js`: job SQL queries.
- `src/dao/filterDao.js`: filter SQL queries.
- `src/utils/helper.js`: parsing + classification helpers.
- `src/utils/constants.js`: domain catalog.
- `src/utils/initializers/postgres.js`: pool init and health helper.
- `src/utils/logger.js`: custom console logger.
- `src/data/greenhouseCompanies.js`: greenhouse source namespace list.
