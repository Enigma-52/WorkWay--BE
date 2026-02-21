import PostgresDao from './dao.js';

const JOB_FEED_COLS =
  'j.id,j.company_id,j.company,j.slug,j.platform,j.title,j.url,j.experience_level,j.employment_type,j.location,j.domain,j.updated_at';
const JOB_LIST_SELECT =
  'j.id,j.company_id,j.company,j.slug,j.platform,j.title,j.url,j.description,j.experience_level,j.employment_type,j.location,j.domain,j.updated_at,j.created_at,c.logo_url AS company_logo_url,c.slug AS company_slug';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * Builds WHERE clauses and values for list/count/facet queries.
 * @param {Object} filters - Normalized filters: { q, domain, employment_type, experience_level, location, company_slug }
 * @param {{ excludeFacet?: string }} opts - If set ('domain'|'employment_type'|'experience_level'), that filter is omitted (for facet counts).
 * @returns {{ whereClauses: string[], values: any[] }}
 */
function buildListWhere(filters, opts = {}) {
  const whereClauses = [];
  const values = [];
  let paramIndex = 1;

  if (filters.q && filters.q.trim()) {
    const pattern = `%${filters.q.trim().replace(/%/g, '\\%')}%`;
    whereClauses.push(`(j.title ILIKE $${paramIndex} OR j.company ILIKE $${paramIndex} OR j.location ILIKE $${paramIndex})`);
    values.push(pattern);
    paramIndex += 1;
  }

  if (opts.excludeFacet !== 'domain' && filters.domain != null && filters.domain !== '') {
    whereClauses.push(`j.domain = $${paramIndex}`);
    values.push(filters.domain);
    paramIndex += 1;
  }

  if (opts.excludeFacet !== 'employment_type' && filters.employment_type != null && filters.employment_type !== '') {
    whereClauses.push(`j.employment_type = $${paramIndex}`);
    values.push(filters.employment_type);
    paramIndex += 1;
  }

  if (opts.excludeFacet !== 'experience_level' && filters.experience_level != null && filters.experience_level !== '') {
    whereClauses.push(`j.experience_level = $${paramIndex}`);
    values.push(filters.experience_level);
    paramIndex += 1;
  }

  if (filters.location != null && filters.location.trim() !== '') {
    whereClauses.push(`j.location ILIKE $${paramIndex}`);
    values.push(`%${filters.location.trim().replace(/%/g, '\\%')}%`);
    paramIndex += 1;
  }

  if (filters.company_slug != null && filters.company_slug.trim() !== '') {
    whereClauses.push(`c.slug = $${paramIndex}`);
    values.push(filters.company_slug.trim());
    paramIndex += 1;
  }

  return { whereClauses, values };
}

export const jobsQ = {
  HOME_FEED: `
    SELECT ${JOB_FEED_COLS}
    FROM jobs j
    WHERE ($1::bigint IS NULL OR j.id < $1)
    ORDER BY j.id DESC
    LIMIT $2;
  `,
  COMPANY_FEED: `
    SELECT ${JOB_FEED_COLS}
    FROM jobs j
    WHERE j.company_id = $1;
  `,
  GET_SINGLE_JOB: `
    SELECT j.* , c.logo_url AS company_logo_url , c.slug AS company_slug
    FROM jobs j
    JOIN companies c ON j.company_id = c.id
    WHERE j.slug = $1;
  `,
  GET_DOMAIN_JOB_EXCLUSION: `
    SELECT ${JOB_FEED_COLS} , c.logo_url AS company_logo_url
    FROM jobs j
    JOIN companies c ON j.company_id = c.id
    WHERE j.domain = $1 AND j.slug != $2
    ORDER BY j.created_at DESC
    LIMIT 3;
  `,
  GET_COMPANY_JOB_EXCLUSION: `
    SELECT ${JOB_FEED_COLS} , c.logo_url AS company_logo_url , c.slug AS company_slug
    FROM jobs j
    JOIN companies c ON j.company_id = c.id
    WHERE j.company = $1 AND j.slug != $2
    ORDER BY j.created_at DESC
    LIMIT 3;
  `,
};

class JobsDao extends PostgresDao {
  constructor() {
    super('jobs');
  }

  async getHomeJobFeed({ lastJobId, limit }) {
    return this.getQ({
      sql: jobsQ.HOME_FEED,
      values: [lastJobId, limit],
    });
  }

  async getCompanyJobFeed({ companyId }) {
    return this.getQ({
      sql: jobsQ.COMPANY_FEED,
      values: [companyId],
    });
  }

  async getSingleJob({ slug }) {
    return this.getQ({
      sql: jobsQ.GET_SINGLE_JOB,
      values: [slug],
    });
  }

  async getDomainJobwithExclusion({ domain, excludeSlug }) {
    return this.getQ({
      sql: jobsQ.GET_DOMAIN_JOB_EXCLUSION,
      values: [domain, excludeSlug],
    });
  }

  async getCompanyJobwithExclusion({ company, excludeSlug }) {
    return this.getQ({
      sql: jobsQ.GET_COMPANY_JOB_EXCLUSION,
      values: [company, excludeSlug],
    });
  }

  /**
   * Search jobs with filters, pagination, and stable sort (created_at DESC, id DESC).
   * @param {{ filters: object, page: number, limit: number, sort: string }} opts
   * @returns {Promise<object[]>} Job rows with company_logo_url, company_slug.
   */
  async searchJobs({ filters, page = 1, limit = DEFAULT_LIMIT, sort = 'recent' }) {
    const safeLimit = Math.min(Math.max(1, Number(limit) || DEFAULT_LIMIT), MAX_LIMIT);
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;

    const { whereClauses, values } = buildListWhere(filters);
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const orderSql = 'ORDER BY j.created_at DESC, j.id DESC';
    const sql = `
      SELECT ${JOB_LIST_SELECT}
      FROM jobs j
      JOIN companies c ON j.company_id = c.id
      ${whereSql}
      ${orderSql}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    return this.getQ({
      sql,
      values: [...values, safeLimit, offset],
    });
  }

  /**
   * Count jobs matching filters.
   * @param {{ filters: object }} opts
   * @returns {Promise<number>}
   */
  async countJobs({ filters }) {
    const { whereClauses, values } = buildListWhere(filters);
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `
      SELECT COUNT(*)::int AS total
      FROM jobs j
      JOIN companies c ON j.company_id = c.id
      ${whereSql}
    `;
    const rows = await this.getQ({ sql, values });
    return rows[0]?.total ?? 0;
  }

  /**
   * Get facet counts for domain, employment_type, experience_level.
   * Each facet query uses filters but excludes that facet so sidebar shows counts per option.
   * @param {{ filters: object }} opts
   * @returns {Promise<{ domains: { domain: string, count: number }[], employment_types: { employment_type: string, count: number }[], experience_levels: { experience_level: string, count: number }[] }>}
   */
  async getJobFacets({ filters }) {
    const base = { domains: [], employment_types: [], experience_levels: [] };

    const runFacet = async (excludeFacet) => {
      const { whereClauses, values } = buildListWhere(filters, { excludeFacet });
      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const groupCol = excludeFacet === 'domain' ? 'j.domain' : excludeFacet === 'employment_type' ? 'j.employment_type' : 'j.experience_level';
      const alias = excludeFacet === 'domain' ? 'domain' : excludeFacet === 'employment_type' ? 'employment_type' : 'experience_level';
      const sql = `
        SELECT ${groupCol} AS ${alias}, COUNT(*)::int AS count
        FROM jobs j
        JOIN companies c ON j.company_id = c.id
        ${whereSql}
        GROUP BY ${groupCol}
        ORDER BY count DESC
      `;
      return this.getQ({ sql, values });
    };

    const [domains, employment_types, experience_levels] = await Promise.all([
      runFacet('domain'),
      runFacet('employment_type'),
      runFacet('experience_level'),
    ]);

    return {
      domains: domains.filter((r) => r.domain != null),
      employment_types: employment_types.filter((r) => r.employment_type != null),
      experience_levels: experience_levels.filter((r) => r.experience_level != null),
    };
  }
}

export const jobsDao = new JobsDao();
export { DEFAULT_LIMIT, MAX_LIMIT };
