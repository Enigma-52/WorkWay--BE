import { defaultPgDao, runPgStatement } from '../dao/dao.js';
import { filtersDao } from '../dao/filterDao.js';
import { JOB_DOMAINS } from '../utils/constants.js';
import { pickRelevantDescriptionSections } from '../utils/helper.js';
import { skillsDao } from '../dao/skillsDao.js';

export async function getDomainJobDetails(slug, page, employment_type, employment_level, location) {
  if (!slug) return null;

  const domain = JOB_DOMAINS.find((d) => d.slug === slug);
  if (!domain) return null;

  const LIMIT = 20;
  const OFFSET = (page - 1) * LIMIT;

  // ✅ 1. Count total rows
  const countRows = await runPgStatement({
    query: `
      SELECT COUNT(*)::int AS count
      FROM jobs
      WHERE domain = $1
    `,
    values: [domain.name],
  });

  const total = countRows[0]?.count || 0;

  const getJobsByDomain = await filtersDao.getJobsByDomain({
    domainName: domain.name,
    limit: LIMIT,
    offset: OFFSET,
    employment_type,
    employment_level,
    location,
  });

  // ✅ 2. Fetch page rows (your existing DAO)
  //   const getJobsByDomain = await defaultPgDao.getAllRows({
  //     tableName: 'jobs',
  //     where: `domain = '${domain.name}'`,
  //     limit: LIMIT,
  //     offset: OFFSET,
  //     orderBy: 'created_at DESC',
  //   });

  // ✅ 3. Transform descriptions (unchanged)
  const transformedJobs = await Promise.all(
    getJobsByDomain.map(async (job) => {
      let pickedSection = null;

      try {
        const desc =
          typeof job.description === 'string' ? JSON.parse(job.description) : job.description;

        pickedSection = await pickRelevantDescriptionSections(desc);
      } catch (e) {
        pickedSection = null;
      }

      return {
        ...job,
        description: pickedSection ? [pickedSection] : [],
      };
    })
  );

  const totalPages = Math.ceil(total / LIMIT);

  return {
    domain: domain,
    jobs: transformedJobs,
    meta: {
      page,
      limit: LIMIT,
      total,
      total_pages: totalPages,
    },
  };
}

export async function getAllDomainJobs() {
  const jobsPerDomain = await filtersDao.getJobsPerDomain();

  const jobsWithSlugs = jobsPerDomain.map((item) => {
    const domain = JOB_DOMAINS.find((d) => d.name === item.domain);
    return {
      ...item,
      slug: domain?.slug || null,
    };
  });

  return jobsWithSlugs;
}

export async function getAllSkillsJobs(){
  const allSkillsWithJobCount = await skillsDao.getAllSkills();
  return allSkillsWithJobCount;
}

export async function getSkillJobDetails(slug,
  page,
  employment_type,
  employment_level, 
  location){
    if (!slug) return null;
    const skill = await skillsDao.getSkillBySlug(slug);
    if (!skill) return null;

    const LIMIT = 20;
    const OFFSET = (page - 1) * LIMIT;
    const countRows = await runPgStatement({
      query: `
        SELECT COUNT(*)::int AS count
        FROM jobs
        CROSS JOIN LATERAL jsonb_array_elements(jobs.skills) AS skill_elem
        WHERE skill_elem->>'name' = $1;
      `,
      values: [skill[0].name],
    });
    const total = countRows[0]?.count || 0;
    const getJobsBySkill = await skillsDao.getJobsBySkill(
      skill[0].name,
      LIMIT,
      OFFSET,
      employment_type,
      employment_level,
      location,
    );
    const transformedJobs = await Promise.all(
      getJobsBySkill.map(async (job) => {
        let pickedSection = null;
  
        try {
          const desc =
            typeof job.description === 'string' ? JSON.parse(job.description) : job.description;
  
          pickedSection = await pickRelevantDescriptionSections(desc);
        } catch (e) {
          pickedSection = null;
        }
  
        return {
          ...job,
          description: pickedSection ? [pickedSection] : [],
        };
      })
    );
    const totalPages = Math.ceil(total / LIMIT);
    return {
      skill: skill[0],
      jobs: transformedJobs,
      meta: {
        page,
        limit: LIMIT,
        total,
        total_pages: totalPages,
      },
    };
}

export async function getAllSkillGroupsJobs() {}