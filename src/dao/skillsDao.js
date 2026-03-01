import PostgresDao from './dao.js';

export const skillsQ = {
  GET_ALL_SKILLS: `
    WITH job_skill_counts AS (
  SELECT
    skill_elem->>'name' AS skill_name,
    COUNT(*) AS job_count
  FROM jobs
  CROSS JOIN LATERAL jsonb_array_elements(jobs.skills) skill_elem
  GROUP BY skill_name
),

skills_with_counts AS (
  SELECT
    s.name AS skill,
    s.slug,
    s.skill_group_name AS category,
    s.skill_group_slug AS category_slug,
    s.skill_group_type AS category_type,
    COALESCE(jsc.job_count, 0) AS job_count
  FROM skills s
  LEFT JOIN job_skill_counts jsc
    ON jsc.skill_name = s.name
),

category_agg AS (
  SELECT
    category,
    COUNT(*) AS skill_count
  FROM skills_with_counts
  GROUP BY category
),

stats AS (
  SELECT
    (SELECT COUNT(*) FROM skills) AS total_skills,
    (SELECT COUNT(*) FROM jobs) AS total_jobs,
    (SELECT COUNT(DISTINCT skill_group_name) FROM skills) AS total_categories
)

SELECT json_build_object(
  'stats', (SELECT row_to_json(stats) FROM stats),
  'categories', (
    SELECT json_agg(category_agg ORDER BY category)
    FROM category_agg
  ),
  'skills', (
    SELECT json_agg(skills_with_counts ORDER BY job_count DESC)
    FROM skills_with_counts
  )
) AS result;
  `,
  GET_SKILL_BY_SLUG: `
    SELECT name, slug FROM skills where slug = $1 limit 1;
  `,
  GET_JOBS_BY_SKILL: `
  SELECT j.* , c.logo_url AS company_logo_url, c.slug AS company_slug
    FROM jobs j
    CROSS JOIN LATERAL jsonb_array_elements(j.skills) skill_elem
    JOIN companies c ON j.company_id = c.id
    WHERE skill_elem->>'name' = $1
    AND ($2::text IS NULL OR j.employment_type = $2)
    AND ($3::text IS NULL OR j.experience_level = $3)
    AND ($4::text IS NULL OR j.location ILIKE '%' || $4 || '%')
    LIMIT $5 OFFSET $6;
    `,
};
    
class SkillsDao extends PostgresDao {
  constructor() {
    super('skills');
  }

  async getAllSkills() {
    const rows = await this.getQ({
      sql: skillsQ.GET_ALL_SKILLS,
      values: [],
    });
  
    return rows[0]?.result;
  }

  async getSkillBySlug(slug) {
    return this.getQ({
      sql: skillsQ.GET_SKILL_BY_SLUG,
      values: [slug],
    });
  }

  async getJobsBySkill(skill_name, limit, offset, employment_type, employment_level, location) {
    return this.getQ({
      sql: skillsQ.GET_JOBS_BY_SKILL,
      values: [
        skill_name,
        employment_type === 'all' ? null : employment_type,
        employment_level === 'all' ? null : employment_level,
        location === 'all' ? null : location,
        limit,
        offset
      ]
    });
  }
}

export const skillsDao = new SkillsDao();
