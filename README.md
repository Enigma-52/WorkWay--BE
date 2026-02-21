# WorkWay--BE

Backend service for WorkWay. This service provides company/job discovery APIs, filter and feed APIs, sitemap generation, and Greenhouse-based ingestion endpoints.

## Tech Stack
- Node.js (ES modules)
- Express 5
- PostgreSQL (`pg`)
- `dotenv`, `nodemon`

## Repository Structure
- `src/server.js`: app bootstrap, DB init, route mount, graceful shutdown.
- `src/config.js`: environment/config mapping.
- `src/routes/`: API route handlers.
- `src/services/`: business logic.
- `src/dao/`: SQL queries and DAO abstractions.
- `src/utils/`: logger, constants, parsing and classification helpers.
- `src/data/greenhouseCompanies.js`: seed list of Greenhouse namespaces.
- `docs/DETAILED_DOCS.md`: detailed architecture and endpoint reference.

## Getting Started
### 1. Install
```bash
npm install
```

### 2. Configure Environment
Create `.env` in repo root (or export env vars):

```env
APP_ENV=dev
POSTGRES_DB_HOST=localhost
POSTGRES_DB_PORT=5432
POSTGRES_DB_USER=postgres
POSTGRES_DB_PASSWORD=root
POSTGRES_DB_DATABASE=eqhqdb
POSTGRES_DB_MAX_CONNECTIONS=20
PORT=3000
```

### 3. Run
```bash
npm run dev
```
Or:
```bash
npm start
```

Service defaults to `http://localhost:3000`.

## Health Endpoints
- `GET /health` -> process uptime and timestamp.
- `GET /` -> plain server-running response.

## API Base Path
All main APIs are under:
- `/api`

Route groups:
- `/api/company`
- `/api/job`
- `/api/feed`
- `/api/filter`
- `/api/cron`
- `/api/sitemap.xml` and `/api/sitemaps/*`

### Jobs page (list + filters)
- `GET /api/job/list` — Paginated job listing with search and filters (e.g. `?q=backend&page=1&limit=20&domain=software-engineering&employment_type=full-time&experience_level=senior&location=remote&sort=recent`). Returns `jobs`, `meta`, `applied_filters`, and `facets`.
- `GET /api/job/filters` — Facet counts for domain, employment type, and experience level (for initial filter UI).

See detailed request/response behavior in:
- `docs/DETAILED_DOCS.md`

## Ingestion Overview
The service exposes cron-style HTTP endpoints that:
- load Greenhouse companies,
- fetch jobs for Greenhouse companies already present in DB,
- classify jobs (domain, level, employment type),
- upsert jobs/companies into PostgreSQL.

## Current Limitations
- No automated tests in repo.
- No auth/rate limiting on cron endpoints in current code.
- Some endpoints rely on optimistic assumptions (for example, existing slug records).

## Related Docs
- `AGENTS.md` for contributor/agent operating context.
- `docs/DETAILED_DOCS.md` for architecture, endpoint details, and runbook notes.
