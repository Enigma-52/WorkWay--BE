# Jobs Page Plan (Search + Filters + Pagination)

This plan defines backend work needed to support a full `/jobs` page experience using the current WorkWay--BE architecture (`routes -> services -> DAO -> PostgreSQL`).

## 1) Goals
- Provide a single jobs listing API.
- Support text search (`q`).
- Support multi-filtering (domain, experience, employment type, location, company).
- Keep sorting stable (recency first, extendable).
- Provide reliable pagination (page/limit now, cursor-ready path).
- Keep response times low as data grows.

## 2) Current State (What Exists Today)
- `GET /api/job/details` returns one job detail + related jobs.
- `GET /api/feed/home` supports cursor-style feed (`lastJobId`, `limit`) but no search/filters.
- `GET /api/filter/domain` supports domain-first filtering with limited filter combinations and page-based offset.
- No dedicated unified listing endpoint for a `/jobs` page.

## 3) Proposed API Surface

### 3.1 Primary listing endpoint
- `GET /api/job/list`

Query params:
- `q` (string, optional)
- `page` (number, default `1`)
- `limit` (number, default `20`, max `50`)
- `sort` (`recent` default; later extend to `relevance`)
- `domain` (slug or `all`)
- `employment_type` (`all` | enum)
- `experience_level` (`all` | enum)
- `location` (string, optional)
- `company_slug` (optional)

Response shape:
- `jobs`: array of projected job cards
- `meta`: `{ page, limit, total, total_pages, has_next, has_prev }`
- `applied_filters`: normalized filters actually used by backend
- `facets`: counts for domain/employment/experience (for UI sidebars)

### 3.2 Optional metadata endpoint (facets-only)
- `GET /api/job/filters`
- Used for initial `/jobs` page load and filter UI hydration.

## 4) Request/Response Contract Rules
- Normalize all filter inputs in service layer.
- Validate enums; treat invalid values as `400` with clear error payload.
- Return only fields needed by jobs cards (avoid `SELECT j.*` in listing queries).
- Keep `job/details` payload unchanged to avoid frontend regressions.

## 5) SQL and DAO Design

### 5.1 New DAO methods
- `jobsDao.searchJobs({ filters, page, limit, sort })`
- `jobsDao.countJobs({ filters })`
- `jobsDao.getJobFacets({ filtersWithoutTargetFacet })`

### 5.2 Query strategy
- Build dynamic `WHERE` with parameterized bindings (no string interpolation).
- Text search (phase 1): `ILIKE` on `title`, `company`, and optionally `location`.
- Text search (phase 2 optimization): PostgreSQL full-text (`tsvector` + `to_tsquery` or `websearch_to_tsquery`).
- Stable order: `ORDER BY created_at DESC, id DESC`.

### 5.3 Pagination strategy
- Phase 1: offset pagination for `/jobs` UI (`page` + `limit`).
- Phase 2: add cursor pagination variant for high pages/infinite scroll:
- `GET /api/job/list?cursor=<id>&limit=20`.
- Keep both modes by branching in service based on params.

## 6) Performance and Index Plan
- Add/verify indexes: `jobs (created_at DESC, id DESC)`, `jobs (domain)`, `jobs (employment_type)`, `jobs (experience_level)`, `jobs (company_id)`.
- Add `jobs (location)` or trigram index support for `ILIKE`.
- If search traffic is high, enable `pg_trgm` and trigram indexes on `title`, `company`, `location`.
- For full-text phase, use a generated `tsvector` column (title + company + description summary) with GIN index.

## 7) Caching and Freshness
- Start without external cache.
- Optional phase: cache facet payload and first-page queries for short TTL (30-120s).
- Invalidate cache after ingestion endpoints run (`/cron/insert_greenhouse`).

## 8) Error Handling + Guardrails
- Add route-level `try/catch` and consistent error response format.
- Handle empty result sets as `200` with `jobs: []` (not `404`).
- Protect with sane `limit` caps and query timeout defaults.

## 9) Rollout Phases

### Phase 1 (MVP for `/jobs`)
- New route `GET /api/job/list`.
- Service normalization + validation.
- DAO query + count query.
- Basic facets (domain/employment/experience).
- Offset pagination and recent sort.

### Phase 2 (Optimization)
- Trigram/full-text search.
- Facet query optimization.
- Cursor pagination variant.
- Query performance audit (`EXPLAIN ANALYZE`) and index tuning.

### Phase 3 (Quality + Scale)
- Add API-level integration tests for filters, pagination, sorting.
- Add telemetry: latency, result count, slow-query logs.
- Optional short-TTL cache for hottest list queries.

## 10) Suggested File Changes (When Implementing)
- `src/routes/job.js`: add `/list` and `/filters`.
- `src/services/jobService.js`: add listing/filter service methods + validation.
- `src/dao/jobsDao.js`: add search/count/facet SQL and DAO wrappers.
- `docs/DETAILED_DOCS.md`: update API reference after implementation.
- `README.md`: add examples for `/api/job/list`.

## 11) API Example

```http
GET /api/job/list?q=backend&page=1&limit=20&domain=software-engineering&employment_type=full-time&experience_level=senior&location=remote&sort=recent
```

```json
{
  "jobs": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "total_pages": 0,
    "has_next": false,
    "has_prev": false
  },
  "applied_filters": {
    "q": "backend",
    "domain": "software-engineering",
    "employment_type": "full-time",
    "experience_level": "senior",
    "location": "remote",
    "sort": "recent"
  },
  "facets": {
    "domains": [],
    "employment_types": [],
    "experience_levels": []
  }
}
```

## 12) Risks and Tradeoffs
- Offset pagination can slow down at deep pages; cursor mode addresses this.
- `ILIKE` search is simple but less relevant than full-text/trigram ranking.
- Facet counts can be expensive if computed on every request without caching/index support.
