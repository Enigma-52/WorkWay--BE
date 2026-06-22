import PostgresDao from './dao.js';

export const companyQ = {
  ALL_COMPANY_LIST: `
    WITH job_counts AS (
      SELECT
        company_id,
        COUNT(*)::int AS total_jobs,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS recent_jobs
      FROM jobs
      GROUP BY company_id
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
      (COALESCE($1, '') = '' OR c.name ILIKE '%' || $1 || '%')
      AND (COALESCE($2, 'ALL') = 'ALL' OR c.name ILIKE $2 || '%')
      AND ($3::boolean = false OR COALESCE(jc.total_jobs, 0) > 0)
      AND (COALESCE($6, '') = '' OR c.platform = $6)
    ORDER BY
      COALESCE(jc.recent_jobs, 0) DESC,
      COALESCE(jc.total_jobs, 0) DESC,
      c.name ASC
    LIMIT $4 OFFSET $5;
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

class CompanyDao extends PostgresDao {
  constructor() {
    super('companies');
  }

  async getAllCompanies({ q, page, limit, letter, hiring, platform }) {
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const search = q || '';
    const letterFilter = letter || 'ALL';
    const hiringOnly = !!hiring;
    const platformFilter = platform || '';

    const listValues = [search, letterFilter, hiringOnly, limitNum, offset, platformFilter];

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
    const TRENDING_COMPANY_IDS = [118 , 1170 , 349 , 286 , 212 , 282  , 341 , 607 , 287];

    const [stats, trending, recent, hiring] = await Promise.all([
      this.getQ({ sql: companyQ.OVERVIEW_STATS, values: [] }),
      this.getQ({ sql: companyQ.OVERVIEW_TRENDING, values: [TRENDING_COMPANY_IDS] }),
      this.getQ({ sql: companyQ.OVERVIEW_RECENTLY_ADDED, values: [] }),
      this.getQ({ sql: companyQ.OVERVIEW_ACTIVELY_HIRING, values: [] }),
    ]);

    return {
      stats: stats?.[0] ?? { total_companies: 0, total_jobs: 0 },
      trending: trending || [],
      recently_added: recent || [],
      actively_hiring: hiring || [],
    };
  }
}

export const companyDao = new CompanyDao();
