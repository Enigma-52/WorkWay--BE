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

## 10) User-Identity Routes Must Be Gated on the Internal Secret

This backend has **no session/auth layer of its own**. Any route that reads a
client-supplied `user_id` (or `email`) straight out of `req.body`/`req.query`
and uses it to read or write that user's data is an IDOR risk unless something
upstream has already verified the caller is who they claim to be.

That verification happens in `workway-next` (NextAuth session), not here. So:

- **Any route trusting a client-supplied user identity must be mounted behind
  `requireInternalSecret`** (`src/utils/internalAuth.js`), either via
  `router.use(requireInternalSecret)` at the top of the route file, or applied
  per-route if the file also has genuinely public routes (see
  `src/routes/user.js`: `/sync` and `/me` are gated, `/unsubscribe` is not —
  it has its own signed-token check instead).
- This currently covers: `applications.js`, `savedJobs.js`, `alerts.js`,
  `apiKeys.js`, and `user.js`'s `/me` (GET+PATCH). `/cron`, `/ai`, `/sync`,
  `/scripts`, `/admin` are gated the same way, some inline in their route
  file and some at the `router.use('/path', requireInternalSecret, routes)`
  mount point in `src/routes/index.js` — either placement is fine, but
  routes with genuinely public sibling endpoints (like `/user/unsubscribe`)
  must gate per-route, not at the mount point.
- **When adding a new route that accepts a `user_id`/`email` from the
  request**, gate it the same way by default. Only skip the gate if the route
  is genuinely meant to be public (rate-limited public search, a
  cryptographically-signed one-time link, a webhook verified by its own
  signature, etc.) — and say why in a comment, the way `/user/unsubscribe`
  and `/api/billing/webhook` do.
- **Pair every new gated route with a workway-next change** that sends the
  `x-internal-api-secret` header (see workway-next's `AGENTS.md`, section on
  the BFF pattern) — a gate with no caller sending the header just breaks the
  feature. Deploy the frontend change first, backend second, so there's never
  a window where the frontend calls a gate it doesn't know about yet.
- The secret itself lives in Doppler (`workway-backend/prd` and
  `workway-frontend/prd` configs, key `INTERNAL_API_SECRET`) — same value in
  both, pulled into the droplet's `.env`/`frontend.env` by
  `workway-infra/deploy.sh`. Never hardcode it; read it via
  `process.env.INTERNAL_API_SECRET`, as `internalAuth.js` does.