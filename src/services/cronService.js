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

  console.log(`Fetched ${companies.length} greenhouse companies from DB`);

  const companyPromises = companies.map(async (company) => {
    try {
      console.log(`Fetching jobs for company: ${company.name}`);
      const jobs = await getJobs(company.namespace);
      console.log(`Found ${jobs.length} jobs for ${company.name}`);
      const jobPromises = jobs.map(async (job) => {
        try {
          const desc = await getJobDescription(company.namespace, job.id);
          const sections = await parseGreenhouseJobDescription(desc.content);

          const jobSlugRaw = company.slug + '-' + job.title + '-' + job.id;
          const jobSlug = jobSlugRaw
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

          const [experience_level, employment_type, domain] = await Promise.all([
            getExperienceLevel(job.title),
            getEmploymentType(job.title),
            getJobDomain(job.title),
          ]);

          const dbRow = {
            company: company.name,
            company_id: company.id,
            slug: jobSlug,
            platform: 'greenhouse',
            job_id: job.id,
            title: job.title,
            url: job.absolute_url,
            description: JSON.stringify(sections),
            experience_level,
            employment_type,
            domain,
            location: job.location ? job.location.name : 'Worldwide',
            updated_at: new Date().toISOString(),
          };
          console.log(`Processed job: ${job.title} (${job.id})`);
          return dbRow;
        } catch (error) {
          console.error(`Failed to fetch job ${job.id} for company ${company.name}:`, error);
          return null;
        }
      });
      return await Promise.all(jobPromises);
    } catch (error) {
      console.error(`Failed to fetch jobs for company ${company.name}:`, error);
      return [];
    }
  });

  const allJobs = await Promise.all(companyPromises);
  const flattenedJobs = allJobs.flat().filter((job) => job !== null);
  console.log(`Total jobs fetched: ${flattenedJobs.length}`);
  result.push(...flattenedJobs);
  await insertGreenhouseJobsToDb(result);
  return { message: 'Fetched and stored greenhouse jobs successfully', count: result.length };
}

export async function insertGreenhouseJobsToDb(jobs) {
  if (!jobs || jobs.length === 0) {
    console.log('No jobs to insert');
    return;
  }

  const BATCH_SIZE = 50;
  const batches = [];

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    batches.push(jobs.slice(i, i + BATCH_SIZE));
  }

  console.log(`Inserting ${jobs.length} jobs in ${batches.length} batches`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const multiRowsColValuesList = batch.map((job) => [
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

    console.log(`Inserted batch ${i + 1}/${batches.length}`);
  }
}

export async function insertGreenhouseCompanies() {
  const uniqueCompanies = [...new Set(greenhouseCompanies)];
  const companyPromises = uniqueCompanies.map(async (company) => {
    try {
      const response = await fetch(`${baseGreenhouseUrl}${company.toLowerCase()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      const companyName = result.name;
      const companyDescription = result.description || 'No description available';

      const dbRow = {
        name: companyName,
        description: companyDescription,
        slug: companyName.toLowerCase().replace(/\s+/g, '-'),
        logo_url: `https://img.logo.dev/${company.toLowerCase()}.com?token=pk_VwiQaQgWRqm2uv-prQBDXw&format=png&theme=dark&retina=true`,
        location: JSON.stringify({}),
        website: null,
        platform: 'greenhouse',
        namespace: company.toLowerCase(),
      };
      console.log(`Prepared company for insertion: ${companyName}`);
      return dbRow;
    } catch (error) {
      console.error(`Failed to fetch company ${company}:`, error);
      return null;
    }
  });

  const results = await Promise.all(companyPromises);
  const companies = results.filter((c) => c !== null);

  // DEDUPE BY SLUG (THIS IS THE IMPORTANT PART)
  const bySlug = new Map();

  for (const c of companies) {
    if (!bySlug.has(c.slug)) {
      bySlug.set(c.slug, c);
    } else {
      console.log('Duplicate slug detected, dropping:', c.slug);
    }
  }

  const dedupedCompanies = Array.from(bySlug.values());

  await insertGreenhouseCompaniesToDb(dedupedCompanies);

  return { message: 'Inserted greenhouse companies successfully', count: companies.length };
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
