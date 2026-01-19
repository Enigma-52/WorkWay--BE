import PostgresDao from './dao.js';

export const companyQ = {
  ALL_COMPANY_LIST: `
    SELECT
  c.id,
  c.slug,
  c.name,
  c.logo_url,
  c.description,
  c.website,

  COUNT(j.id)::int AS jobs_open_count,
  (COUNT(j.id) > 0) AS is_actively_hiring

FROM companies c
LEFT JOIN jobs j
  ON j.company_id = c.id

WHERE
  (COALESCE($1, '') = '' OR c.name ILIKE '%' || $1 || '%')
  AND (COALESCE($2, 'ALL') = 'ALL' OR c.name ILIKE $2 || '%')

GROUP BY
  c.id, c.slug, c.name, c.logo_url, c.description

HAVING
  ($3::boolean = false OR COUNT(j.id) > 0)

ORDER BY
  (COUNT(j.id) > 0) DESC,
  COUNT(j.id) DESC,
  c.name ASC

LIMIT $4 OFFSET $5;
  `,
  ALL_COMPANY_COUNT: `
    SELECT COUNT(*)::int AS total
FROM (
  SELECT c.id
  FROM companies c
  LEFT JOIN jobs j
    ON j.company_id = c.id
  WHERE
    (COALESCE($1, '') = '' OR c.name ILIKE '%' || $1 || '%')
    AND (COALESCE($2, 'ALL') = 'ALL' OR c.name ILIKE $2 || '%')
  GROUP BY c.id
  HAVING
    ($3::boolean = false OR COUNT(j.id) > 0)
) sub;
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
  LEFT JOIN jobs j
    ON j.company_id = c.id
  GROUP BY
    c.id, c.slug, c.name, c.logo_url, c.description, c.website
  HAVING
    COUNT(j.id) > 0
  ORDER BY
    COUNT(j.id) DESC
  LIMIT 6;
`,
};

class CompanyDao extends PostgresDao {
  constructor() {
    super('companies');
  }

  async getAllCompanies({ q, page, limit, letter, hiring }) {
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const search = q || '';
    const letterFilter = letter || 'ALL';
    const hiringOnly = !!hiring;

    const listValues = [search, letterFilter, hiringOnly, limitNum, offset];

    const listResult = await this.getQ({
      sql: companyQ.ALL_COMPANY_LIST,
      values: listValues,
    });

    const countResult = await this.getQ({
      sql: companyQ.ALL_COMPANY_COUNT,
      values: [search, letterFilter, hiringOnly],
    });

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

  async getOverview() {
    const TRENDING_COMPANY_IDS = [1, 3, 5, 203, 177];

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
