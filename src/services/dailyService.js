import { defaultPgDao } from '../dao/dao.js';
import { fetchWithRetry } from '../utils/apiClient.js';
import { jobsDao } from '../dao/jobsDao.js';
import {
  parseGreenhouseJobDescription,
  getExperienceLevel,
  getEmploymentType,
  getJobDomain,
} from '../utils/helper.js';
import { matchSkillsInText } from '../data/skills.js';

const baseGreenhouseUrl = 'https://boards-api.greenhouse.io/v1/boards/';

export async function getJobs(company) {
  const url = `${baseGreenhouseUrl}${company.toLowerCase()}/jobs`;

  try {
    const response = await fetchWithRetry(url);

    // Defensive validation
    if (!response || !Array.isArray(response.jobs)) {
      return { jobs: [] };
    }

    return response;
  } catch (err) {
    if (err?.message?.includes('404')) {
      console.log(`Greenhouse board not found for ${company}`);
      return { jobs: [] };
    }

    console.error(`Greenhouse fetch failed for ${company}`, err.message);
    return { jobs: [] }; // Do NOT throw — keep flow running
  }
}

export async function insertGreenhouseJobsDaily() {
  const companies = await defaultPgDao.getAllRows({
    tableName: 'companies',
    where: "platform = 'greenhouse'",
  });
  const c = companies.length;
  let t = 0;
  const jobs = [];
  for (const company of companies) {
    const getJobsForCompanyFromDB = await defaultPgDao.getAllRowsForChat({
      tableName: 'jobs',
      columns: ['job_id'],
      where: `company_id = ${company.id}`,
    });
    const jobIdsFromDB = new Set(getJobsForCompanyFromDB.map((row) => row.job_id));
    const result = await getJobs(company.namespace);
    const apiJobIds = result.jobs.map((job) => String(job.id));
    const missingJobIds = apiJobIds.filter((id) => !jobIdsFromDB.has(id));
    t += 1;
    if (missingJobIds.length == 0) continue;
    await processMissingForCompany(missingJobIds, company);
    console.log('Inserted ', missingJobIds.length, ' jobs for ', company.namespace, ' ', t, '/', c);
  }
  return { success: 'true' };
}

// export async function processMissingForCompany(missingJobIds, company) {
//   const jobsToInsert = [];
//   for (const jobId of missingJobIds) {
//     const jobUrl = `${baseGreenhouseUrl}${company.namespace.toLowerCase()}/jobs/${jobId}`;
//     const jobDetails = await fetchWithRetry(jobUrl);
//     const sections = await parseGreenhouseJobDescription(jobDetails.content);
//     const sectionText = sections.map((s) => [s.heading, ...(s.content || [])].join(' ')).join('\n');
//     const skills = matchSkillsInText(sectionText);

//     const jobSlugRaw = company.slug + '-' + jobDetails.title + '-' + jobDetails.id;
//     const jobSlug = jobSlugRaw
//       .toLowerCase()
//       .replace(/[^a-z0-9]+/g, '-')
//       .replace(/^-+|-+$/g, '');

//     const [experience_level, employment_type, domain] = await Promise.all([
//       getExperienceLevel(jobDetails.title),
//       getEmploymentType(jobDetails.title),
//       getJobDomain(jobDetails.title),
//     ]);

//     const dbRow = {
//       company: company.name,
//       company_id: company.id,
//       slug: jobSlug,
//       platform: 'greenhouse',
//       job_id: jobDetails.id,
//       title: jobDetails.title,
//       url: jobDetails.absolute_url,
//       description: JSON.stringify(sections),
//       experience_level,
//       employment_type,
//       domain,
//       location: jobDetails.location ? jobDetails.location.name : 'Worldwide',
//       skills: JSON.stringify(skills),
//       updated_at: new Date().toISOString(),
//     };
//     jobsToInsert.push(dbRow);
//   }
//   const multiRowsColValuesList = jobsToInsert.map((job) => [
//     job.company,
//     job.company_id,
//     job.slug,
//     job.platform,
//     job.job_id,
//     job.title,
//     job.url,
//     job.description,
//     job.experience_level,
//     job.employment_type,
//     job.domain,
//     job.location,
//     job.skills,
//     job.updated_at,
//   ]);

//   try {
//     await defaultPgDao.insertOrUpdateMultipleObjs({
//       tableName: 'jobs',
//       columnNames: [
//         'company',
//         'company_id',
//         'slug',
//         'platform',
//         'job_id',
//         'title',
//         'url',
//         'description',
//         'experience_level',
//         'employment_type',
//         'domain',
//         'location',
//         'skills',
//         'updated_at',
//       ],
//       multiRowsColValuesList,
//       updateColumnNames: [
//         'title',
//         'url',
//         'description',
//         'experience_level',
//         'employment_type',
//         'domain',
//         'location',
//         'skills',
//         'updated_at',
//       ],
//       conflictColumns: ['slug'],
//       returningCol: 'id',
//     });
//   } catch (error) {
//     console.log('oopsie');
//   }
// }

export async function processMissingForCompany(missingJobIds, company) {
  if (!missingJobIds.length) return;

  const concurrency = 3; // safe small boost

  const jobsToInsert = await mapWithConcurrency(missingJobIds, concurrency, async (jobId) => {
    const jobUrl = `${baseGreenhouseUrl}${company.namespace.toLowerCase()}/jobs/${jobId}`;
    const jobDetails = await fetchWithRetry(jobUrl);

    const sections = await parseGreenhouseJobDescription(jobDetails.content);
    const sectionText = sections.map((s) => [s.heading, ...(s.content || [])].join(' ')).join('\n');

    const skills = matchSkillsInText(sectionText);

    const jobSlugRaw = company.slug + '-' + jobDetails.title + '-' + jobDetails.id;

    const jobSlug = jobSlugRaw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const [experience_level, employment_type, domain] = await Promise.all([
      getExperienceLevel(jobDetails.title),
      getEmploymentType(jobDetails.title),
      getJobDomain(jobDetails.title),
    ]);

    return {
      company: company.name,
      company_id: company.id,
      slug: jobSlug,
      platform: 'greenhouse',
      job_id: jobDetails.id,
      title: jobDetails.title,
      url: jobDetails.absolute_url,
      description: JSON.stringify(sections),
      experience_level,
      employment_type,
      domain,
      location: jobDetails.location ? jobDetails.location.name : 'Worldwide',
      skills: JSON.stringify(skills),
      updated_at: new Date().toISOString(),
    };
  });

  const multiRowsColValuesList = jobsToInsert.map((job) => [
    job.company,
    job.company_id,
    job.slug,
    job.platform,
    job.job_id,
    job.title,
    job.url,
    job.description,
    job.experience_level,
    job.employment_type,
    job.domain,
    job.location,
    job.skills,
    job.updated_at,
  ]);

  try {
    await defaultPgDao.insertOrUpdateMultipleObjs({
      tableName: 'jobs',
      columnNames: [
        'company',
        'company_id',
        'slug',
        'platform',
        'job_id',
        'title',
        'url',
        'description',
        'experience_level',
        'employment_type',
        'domain',
        'location',
        'skills',
        'updated_at',
      ],
      multiRowsColValuesList,
      updateColumnNames: [
        'title',
        'url',
        'description',
        'experience_level',
        'employment_type',
        'domain',
        'location',
        'skills',
        'updated_at',
      ],
      conflictColumns: ['slug'],
      returningCol: 'id',
    });
  } catch (error) {
    console.log(error);
  }
}

async function mapWithConcurrency(items, limit, asyncFn) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await asyncFn(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: limit }, () => worker());
  await Promise.all(workers);
  return results;
}
