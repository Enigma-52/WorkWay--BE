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
    )
    SELECT
    s.name as skill,s.slug,
    COALESCE(jsc.job_count, 0) AS job_count
    FROM skills s
    LEFT JOIN job_skill_counts jsc
    ON jsc.skill_name = s.name
    ORDER BY job_count DESC;
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
    return this.getQ({
        sql: skillsQ.GET_ALL_SKILLS,
        values: [],
      });
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
