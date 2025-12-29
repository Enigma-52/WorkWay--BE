import { greenhouseCompanies } from '../data/greenhouseCompanies.js';
import {
  parseGreenhouseJobDescription,
  getExperienceLevel,
  getEmploymentType,
  getJobDomain,
} from '../utils/helper.js';
import { defaultPgDao } from '../dao/dao.js';

const baseGreenhouseUrl = 'https://boards-api.greenhouse.io/v1/boards/';

export async function getJobs(company) {
  const response = await fetch(`${baseGreenhouseUrl}${company.toLowerCase()}/jobs`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const result = await response.json();
  // Return the first 5 jobs
  return result.jobs.slice(0, 5);
}

export async function getJobDescription(company, jobId) {
  const response = await fetch(`${baseGreenhouseUrl}${company.toLowerCase()}/jobs/${jobId}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

export async function fetchGreenhouseJobs() {
  const result = [];

  const companies = await defaultPgDao.getAllRows({
    tableName: 'companies',
    where: "platform = 'greenhouse'",
  });

  for (const company of companies) {
    try {
      const jobs = await getJobs(company.namespace);
      for (const job of jobs) {
        try {
          const desc = await getJobDescription(company.namespace, job.id);
          const sections = await parseGreenhouseJobDescription(desc.content);

          const jobSlugRaw = company.slug + '-' + job.title + '-' + job.id;
          const jobSlug = jobSlugRaw
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

          const dbRow = {
            company: company.name,
            company_id: company.id,
            slug: jobSlug,
            platform: 'greenhouse',
            job_id: job.id,
            title: job.title,
            url: job.absolute_url,
            description: JSON.stringify(sections),
            experience_level: await getExperienceLevel(job.title),
            employment_type: await getEmploymentType(job.title),
            domain: await getJobDomain(job.title),
            location: job.location ? job.location.name : 'Worldwide',
            updated_at: new Date().toISOString(),
          };
          result.push(dbRow);
        } catch (error) {
          console.error(`Failed to fetch job ${job.id} for company ${company.name}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch jobs for company ${company.name}:`, error);
    }
  }
  await insertGreenhouseJobsToDb(result);
  return { message: 'Fetched and stored greenhouse jobs successfully', count: result.length };
}

export async function insertGreenhouseJobsToDb(jobs) {
  const multiRowsColValuesList = jobs.map((job) => [
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
    job.updated_at,
  ]);

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
      'updated_at',
    ],
    conflictColumns: ['slug'],
    returningCol: 'id',
  });
}

export async function insertGreenhouseCompanies() {
  const companies = [];
  for (const company of greenhouseCompanies) {
    const response = await fetch(`${baseGreenhouseUrl}${company.toLowerCase()}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    const companyName = result.name;
    const companyDescription = result.description || 'No description available';

    const dbRow = {
      name: companyName,
      description: companyDescription,
      slug: companyName.toLowerCase().replace(/\s+/g, '-'),
      logo_url: `https://img.logo.dev/${company.toLowerCase()}.com?token=pk_VwiQaQgWRqm2uv-prQBDXw`,
      location: JSON.stringify({}),
      website: null,
      platform: 'greenhouse',
      namespace: company.toLowerCase(),
    };
    companies.push(dbRow);
  }

  await insertGreenhouseCompaniesToDb(companies);
  return { message: 'Inserted greenhouse companies successfully' };
}

export async function insertGreenhouseCompaniesToDb(companies) {
  const multiRowsColValuesList = companies.map((company) => [
    company.name,
    company.description,
    company.slug,
    company.logo_url,
    company.location,
    company.website,
    company.platform,
    company.namespace,
  ]);

  await defaultPgDao.insertOrUpdateMultipleObjs({
    tableName: 'companies',
    columnNames: [
      'name',
      'description',
      'slug',
      'logo_url',
      'location',
      'website',
      'platform',
      'namespace',
    ],
    multiRowsColValuesList,
    updateColumnNames: ['description', 'logo_url', 'location', 'website', 'platform', 'namespace'],
    conflictColumns: ['slug'],
    returningCol: 'id',
  });
}
