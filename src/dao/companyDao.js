import PostgresDao from './dao.js';

export const companyQ = {
  // job_counts is passed in as a precomputed/cached JSON blob (see
  // companyDao.getCachedJobCountsByCompany) instead of being recomputed via
  // GROUP BY over the full jobs table on every search request — that GROUP BY
  // is completely independent of the search text/letter/platform filters, so
  // it was doing identical, avoidable full-table work on every keystroke.
  ALL_COMPANY_LIST: `
    WITH job_counts AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb)
        AS x(company_id bigint, total_jobs int, recent_jobs int)
    )
    SELECT
      c.id,
      c.slug,
      c.name,
      c.logo_url,
      c.description,
      c.website,
      COALESCE(jc.total_jobs, 0) AS jobs_open_count,
      (COALESCE(jc.total_jobs, 0) > 0) AS is_actively_hiring
    FROM companies c
    LEFT JOIN job_counts jc ON jc.company_id = c.id
    WHERE
      (COALESCE($2, '') = '' OR c.name ILIKE '%' || $2 || '%')
      AND (COALESCE($3, 'ALL') = 'ALL' OR c.name ILIKE $3 || '%')
      AND ($4::boolean = false OR COALESCE(jc.total_jobs, 0) > 0)
      AND (COALESCE($7, '') = '' OR c.platform = $7)
    ORDER BY
      COALESCE(jc.recent_jobs, 0) DESC,
      COALESCE(jc.total_jobs, 0) DESC,
      c.name ASC
    LIMIT $5 OFFSET $6;
  `,
  JOB_COUNTS_BY_COMPANY: `
    SELECT
      company_id,
      COUNT(*)::int AS total_jobs,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS recent_jobs
    FROM jobs
    GROUP BY company_id;
  `,
  ALL_COMPANY_COUNT: `
    SELECT COUNT(*)::int AS total
    FROM companies c
    WHERE
      (COALESCE($1, '') = '' OR c.name ILIKE '%' || $1 || '%')
      AND (COALESCE($2, 'ALL') = 'ALL' OR c.name ILIKE $2 || '%')
      AND ($3::boolean = false OR EXISTS(SELECT 1 FROM jobs j WHERE j.company_id = c.id))
      AND (COALESCE($4, '') = '' OR c.platform = $4);
  `,
  OVERVIEW_STATS: `
    SELECT
      (SELECT COUNT(*)::int FROM companies) AS total_companies,
      (SELECT COUNT(*)::int FROM jobs) AS total_jobs;
  `,
  OVERVIEW_TRENDING: `
    SELECT
      c.id,
      c.slug,
      c.name,
      c.logo_url,
      c.description,
      c.website
    FROM companies c
    WHERE
      c.id = ANY($1::int[])
  `,
  OVERVIEW_RECENTLY_ADDED: `
    SELECT
      c.id,
      c.slug,
      c.name,
      c.logo_url,
      c.description,
      c.website
    FROM companies c
    ORDER BY
      c.created_at DESC
    LIMIT 6;
  `,
  OVERVIEW_ACTIVELY_HIRING: `
  SELECT
    c.id,
    c.slug,
    c.name,
    c.logo_url,
    c.description,
    c.website,
    true AS is_actively_hiring
  FROM companies c
  INNER JOIN (
    SELECT company_id, COUNT(*)::int AS job_count
    FROM jobs
    GROUP BY company_id
  ) jc ON jc.company_id = c.id
  ORDER BY jc.job_count DESC
  LIMIT 6;
`,
  GET_COMPANIES_WITHOUT_EMBEDDINGS: `
    SELECT id, name, description
    FROM companies
    WHERE embedding IS NULL
    ORDER BY id ASC;
  `,
  GET_ALL_COMPANY_EMBEDDINGS: `
    SELECT id, name, slug, embedding
    FROM companies
    WHERE embedding IS NOT NULL
    ORDER BY id ASC;
  `,
  UPDATE_COMPANY_EMBEDDING: `
    UPDATE companies SET embedding = $1 WHERE id = $2;
  `,
};

const JOB_COUNTS_BY_COMPANY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let jobCountsByCompanyCache = null; // { json, expiresAt }

// getOverview() has zero parameters — it's a fully global computation
// (stats, fixed trending IDs, recently added, actively-hiring top-6, the
// latter also doing a GROUP BY over the full jobs table). Cache the whole
// result rather than recomputing on every homepage/overview widget hit.
const OVERVIEW_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let overviewCache = null; // { result, expiresAt }

class CompanyDao extends PostgresDao {
  constructor() {
    super('companies');
  }

  async getCachedJobCountsByCompanyJson() {
    if (jobCountsByCompanyCache && jobCountsByCompanyCache.expiresAt > Date.now()) {
      return jobCountsByCompanyCache.json;
    }
    const rows = await this.getQ({ sql: companyQ.JOB_COUNTS_BY_COMPANY, values: [] });
    const json = JSON.stringify(rows);
    jobCountsByCompanyCache = { json, expiresAt: Date.now() + JOB_COUNTS_BY_COMPANY_CACHE_TTL_MS };
    return json;
  }

  async getAllCompanies({ q, page, limit, letter, hiring, platform }) {
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const search = q || '';
    const letterFilter = letter || 'ALL';
    const hiringOnly = !!hiring;
    const platformFilter = platform || '';

    const jobCountsJson = await this.getCachedJobCountsByCompanyJson();
    const listValues = [jobCountsJson, search, letterFilter, hiringOnly, limitNum, offset, platformFilter];

    const [listResult, countResult] = await Promise.all([
      this.getQ({
        sql: companyQ.ALL_COMPANY_LIST,
        values: listValues,
      }),
      this.getQ({
        sql: companyQ.ALL_COMPANY_COUNT,
        values: [search, letterFilter, hiringOnly, platformFilter],
      }),
    ]);

    const total = countResult?.[0]?.total ?? 0;

    return {
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        hasNext: pageNum * limitNum < total,
      },
      companies: listResult || [],
    };
  }

  async getAllCompanyEmbeddings() {
    return this.getQ({
      sql: companyQ.GET_ALL_COMPANY_EMBEDDINGS,
      values: [],
    });
  }

  async getCompaniesWithoutEmbeddings() {
    return this.getQ({
      sql: companyQ.GET_COMPANIES_WITHOUT_EMBEDDINGS,
      values: [],
    });
  }

  async updateCompanyEmbedding(companyId, embedding) {
    return this.updateQ({
      sql: companyQ.UPDATE_COMPANY_EMBEDDING,
      values: [JSON.stringify(embedding), companyId],
    });
  }

  async getOverview() {
    if (overviewCache && overviewCache.expiresAt > Date.now()) {
      return overviewCache.result;
    }

    const TRENDING_COMPANY_IDS = [118 , 1170 , 349 , 286 , 212 , 282  , 341 , 607 , 287];

    const [stats, trending, recent, hiring] = await Promise.all([
      this.getQ({ sql: companyQ.OVERVIEW_STATS, values: [] }),
      this.getQ({ sql: companyQ.OVERVIEW_TRENDING, values: [TRENDING_COMPANY_IDS] }),
      this.getQ({ sql: companyQ.OVERVIEW_RECENTLY_ADDED, values: [] }),
      this.getQ({ sql: companyQ.OVERVIEW_ACTIVELY_HIRING, values: [] }),
    ]);

    const result = {
      stats: stats?.[0] ?? { total_companies: 0, total_jobs: 0 },
      trending: trending || [],
      recently_added: recent || [],
      actively_hiring: hiring || [],
    };
    overviewCache = { result, expiresAt: Date.now() + OVERVIEW_CACHE_TTL_MS };
    return result;
  }

  // Called after ingestion crons finish so the next request recomputes
  // fresh data instead of waiting out the full 24h TTL.
  clearCache() {
    jobCountsByCompanyCache = null;
    overviewCache = null;
  }
}

export const companyDao = new CompanyDao();
