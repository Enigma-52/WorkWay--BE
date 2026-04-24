import PostgresDao from './dao.js';

const JOB_FEED_COLS =
  'j.id,j.company_id,j.company,j.slug,j.platform,j.title,j.url,j.experience_level,j.employment_type,j.location,j.domain,j.skills,j.updated_at,j.metadata';
const JOB_LIST_SELECT =
  'j.id,j.company_id,j.company,j.slug,j.platform,j.title,j.url,j.description,j.experience_level,j.employment_type,j.location,j.domain,j.skills,j.updated_at,j.created_at,c.logo_url AS company_logo_url,c.slug AS company_slug,j.metadata';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * Builds WHERE clauses and values for list/count/facet queries.
 * @param {Object} filters - Normalized filters: { q, domain, employment_type, experience_level, location, company_slug, skill_slug? }
 * @param {{ excludeFacet?: string }} opts - If set ('domain'|'employment_type'|'experience_level'), that filter is omitted (for facet counts).
 * @returns {{ whereClauses: string[], values: any[] }}
 */
function buildListWhere(filters, opts = {}) {
  const whereClauses = [];
  const values = [];
  let paramIndex = 1;

  if (filters.skill_slug != null && String(filters.skill_slug).trim() !== '') {
    const slug = String(filters.skill_slug).trim().toLowerCase();
    whereClauses.push(`j.skills @> $${paramIndex}::jsonb`);
    values.push(JSON.stringify([{ slug }]));
    paramIndex += 1;
  }

  if (filters.q && filters.q.trim()) {
    const pattern = `%${filters.q.trim().replace(/%/g, '\\%')}%`;
    whereClauses.push(`(j.title ILIKE $${paramIndex} OR j.company ILIKE $${paramIndex})`);
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
  GET_JOBS_FOR_COMPANY_FROM_DB : `
  SELECT job_id from jobs where company_id = $1;`,
  GET_RECENT_JOBS_FOR_COMPANY_FROM_DB : `
    SELECT ${JOB_FEED_COLS}
    FROM jobs j
    WHERE j.company_id = $1
    AND created_at >= NOW() - INTERVAL '3 days'
    ORDER BY created_at DESC;
  `,
  GET_SIMILAR_LOCATION_JOBS: `
    SELECT ${JOB_FEED_COLS}, c.logo_url AS company_logo_url, c.slug AS company_slug
    FROM jobs j
    JOIN companies c ON j.company_id = c.id
    WHERE j.slug != $2
      AND j.location ILIKE '%' || $1 || '%'
    ORDER BY j.created_at DESC
    LIMIT 6;
  `,
  GET_JOBS_BY_SKILL_SLUG: `
    SELECT ${JOB_FEED_COLS},
      c.logo_url AS company_logo_url,
      c.slug AS company_slug
    FROM jobs j
    JOIN companies c ON j.company_id = c.id
    WHERE j.skills @> $1::jsonb
      AND j.slug != $2
    ORDER BY j.created_at DESC
    LIMIT 3;
  `
};

const SALARY_STATS_QUERY = `
  SELECT
    j.id,
    j.metadata->>'compensation' AS compensation,
    j.domain,
    j.experience_level
  FROM jobs j
  WHERE j.platform = 'ashby'
    AND j.metadata->>'compensation' IS NOT NULL
    AND j.metadata->>'compensation' != '';
`;

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

  async getJobsForCompanyFromDB(companyId) {
    return this.getQ({
      sql : jobsQ.GET_JOBS_FOR_COMPANY_FROM_DB,
      values : [companyId]
    }
    )
  }
  
  async getCompanyRecentlyPostedJobs({companyId}){
    return this.getQ({
        sql : jobsQ.GET_RECENT_JOBS_FOR_COMPANY_FROM_DB,
        values : [companyId]
      }
    )
  }

  async getSalaryStatsRows() {
    return this.getQ({ sql: SALARY_STATS_QUERY, values: [] });
  }

  async getSalaryInsightsJobs({ filters = {}, page = 1, limit = 20, sort = 'salary_desc' }) {
    const whereClauses = [
      `j.platform = 'ashby'`,
      `j.metadata->>'compensation' IS NOT NULL`,
      `j.metadata->>'compensation' != ''`,
    ];
    const values = [];
    let paramIndex = 1;

    if (filters.domain && filters.domain !== 'all') {
      whereClauses.push(`j.domain = $${paramIndex}`);
      values.push(filters.domain);
      paramIndex++;
    }
    if (filters.experience_level && filters.experience_level !== 'all') {
      whereClauses.push(`j.experience_level = $${paramIndex}`);
      values.push(filters.experience_level);
      paramIndex++;
    }
    if (filters.employment_type && filters.employment_type !== 'all') {
      whereClauses.push(`j.employment_type = $${paramIndex}`);
      values.push(filters.employment_type);
      paramIndex++;
    }
    if (filters.equity === 'yes') {
      whereClauses.push(`j.metadata->>'compensation' ILIKE '%equity%'`);
    } else if (filters.equity === 'no') {
      whereClauses.push(`j.metadata->>'compensation' NOT ILIKE '%equity%'`);
    }
    if (filters.bonus === 'yes') {
      whereClauses.push(`j.metadata->>'compensation' ILIKE '%bonus%'`);
    } else if (filters.bonus === 'no') {
      whereClauses.push(`j.metadata->>'compensation' NOT ILIKE '%bonus%'`);
    }
    if (filters.location && filters.location !== '') {
      whereClauses.push(`j.location ILIKE $${paramIndex}`);
      values.push(`%${filters.location}%`);
      paramIndex++;
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 50);
    const offset = (Math.max(1, Number(page) || 1) - 1) * safeLimit;

    const orderSql = sort === 'salary_asc' ? 'ORDER BY j.created_at ASC' :
                     sort === 'recent' ? 'ORDER BY j.created_at DESC' :
                     'ORDER BY j.created_at DESC';

    const [rows, countRows] = await Promise.all([
      this.getQ({
        sql: `
          SELECT j.id, j.title, j.company, j.slug, j.domain, j.location,
            j.experience_level, j.employment_type, j.skills,
            j.metadata->>'compensation' AS compensation,
            j.metadata, j.platform, j.url, j.updated_at,
            c.logo_url AS company_logo_url, c.slug AS company_slug,
            j.created_at
          FROM jobs j
          JOIN companies c ON j.company_id = c.id
          ${whereSql}
          ${orderSql}
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        values: [...values, safeLimit, offset],
      }),
      this.getQ({
        sql: `SELECT COUNT(*)::int AS total FROM jobs j ${whereSql}`,
        values,
      }),
    ]);

    return {
      jobs: rows,
      total: countRows[0]?.total ?? 0,
      page: Math.max(1, Number(page) || 1),
      limit: safeLimit,
    };
  }

  async getSimilarLocationJobs({ location, excludeSlug }) {
    // Extract the most meaningful location part for fuzzy matching
    // e.g. "San Francisco, CA" -> try "San Francisco" first
    const parts = location.split(',').map((p) => p.trim()).filter(Boolean);
    const searchTerm = parts[0] || location;
    return this.getQ({
      sql: jobsQ.GET_SIMILAR_LOCATION_JOBS,
      values: [searchTerm, excludeSlug],
    });
  }

  async getRecentJobsBySkills({ skillSlugs, excludeSlug, skillNames = [] }) {
    // Run one small query per skill (max 3) in parallel — each uses GIN index
    const results = await Promise.all(
      skillSlugs.map((slug, i) =>
        this.getQ({
          sql: jobsQ.GET_JOBS_BY_SKILL_SLUG,
          values: [JSON.stringify([{ slug }]), excludeSlug],
        }).then((jobs) => ({
          skill_slug: slug,
          skill_name: skillNames[i] || slug,
          jobs,
        }))
      )
    );
    return results.filter((g) => g.jobs.length > 0);
  }
}

export const jobsDao = new JobsDao();
export { DEFAULT_LIMIT, MAX_LIMIT };
