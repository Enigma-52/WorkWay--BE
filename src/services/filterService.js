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

  const [countRows, getJobsByDomain] = await Promise.all([
    runPgStatement({
      query: `
        SELECT COUNT(*)::int AS count
        FROM jobs
        WHERE domain = $1
          AND ($2 = 'all' OR employment_type = $2)
          AND ($3 = 'all' OR experience_level = $3)
          AND ($4 = 'all' OR location ILIKE '%' || $4 || '%')
          AND is_active = true
      `,
      values: [domain.name, employment_type, employment_level, location],
    }),
    filtersDao.getJobsByDomain({
      domainName: domain.name,
      limit: LIMIT,
      offset: OFFSET,
      employment_type,
      employment_level,
      location,
    }),
  ]);

  const total = countRows[0]?.count || 0;

  // ✅ 2. Fetch page rows (your existing DAO)
  //   const getJobsByDomain = await defaultPgDao.getAllRows({
  //     tableName: 'jobs',
  //     where: `domain = '${domain.name}'`,
  //     limit: LIMIT,
  //     offset: OFFSET,
  //     orderBy: 'created_at DESC',
  //   });

  // Transform descriptions
  const transformedJobs = getJobsByDomain.map((job) => {
    let pickedSection = null;

    try {
      const desc =
        typeof job.description === 'string' ? JSON.parse(job.description) : job.description;

      pickedSection = pickRelevantDescriptionSections(desc);
    } catch (e) {
      pickedSection = null;
    }

    return {
      ...job,
      description: pickedSection ? [pickedSection] : [],
    };
  });

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
    const skillJsonb = JSON.stringify([{ name: skill[0].name }]);
    const [countRows, getJobsBySkill] = await Promise.all([
      runPgStatement({
        query: `
          SELECT COUNT(*)::int AS count
          FROM jobs
          WHERE skills @> $1::jsonb
            AND ($2::text IS NULL OR employment_type = $2)
            AND ($3::text IS NULL OR experience_level = $3)
            AND ($4::text IS NULL OR location ILIKE '%' || $4 || '%')
            AND is_active = true
        `,
        values: [
          skillJsonb,
          employment_type === 'all' ? null : employment_type,
          employment_level === 'all' ? null : employment_level,
          location === 'all' ? null : location,
        ],
      }),
      skillsDao.getJobsBySkill(skill[0].name, LIMIT, OFFSET, employment_type, employment_level, location),
    ]);
    const total = countRows[0]?.count || 0;
    const transformedJobs = getJobsBySkill.map((job) => {
      let pickedSection = null;

      try {
        const desc =
          typeof job.description === 'string' ? JSON.parse(job.description) : job.description;

        pickedSection = pickRelevantDescriptionSections(desc);
      } catch (e) {
        pickedSection = null;
      }

      return {
        ...job,
        description: pickedSection ? [pickedSection] : [],
      };
    });
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