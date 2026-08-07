# WorkWay Backend

API service powering [WorkWay](https://www.workway.dev) — company/job discovery, filters, sitemaps, and Greenhouse/Ashby/YC ingestion.

## Stack

- Node.js (ES modules) + Express 5
- PostgreSQL (`pg`)

## Structure

- `src/server.js` — app bootstrap, DB init, route mount, graceful shutdown
- `src/config.js` — environment/config mapping
- `src/routes/` — API route handlers
- `src/services/` — business logic
- `src/dao/` — SQL queries and DAO abstractions
- `src/utils/` — logger, constants, parsing/classification helpers
- `src/data/greenhouseCompanies.js` — seed list of Greenhouse namespaces
- `docs/DETAILED_DOCS.md` — detailed architecture and endpoint reference

## Setup

```bash
npm install
```

Create `.env` in repo root:

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

Run:

```bash
npm run dev   # or: npm start
```

Defaults to `http://localhost:3000`.

## API

Base path: `/api`

- `/api/company`, `/api/job`, `/api/feed`, `/api/filter`, `/api/cron`
- `/api/sitemap.xml`, `/api/sitemaps/*`
- `GET /api/job/list` — paginated job listing with search/filters, returns `jobs`, `meta`, `applied_filters`, `facets`
- `GET /api/job/filters` — facet counts for the filter UI

Full request/response reference: `docs/DETAILED_DOCS.md`

## Health

- `GET /health` — uptime + timestamp
- `GET /` — server-running check

## Ingestion

Cron-style HTTP endpoints load Greenhouse, Ashby, and YC companies, fetch their jobs, classify them (domain/level/employment type), and upsert into PostgreSQL.

## Production

Serves **[workway.dev](https://www.workway.dev)**.
