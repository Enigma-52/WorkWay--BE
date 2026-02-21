import { greenhouseCompanies } from '../data/greenhouseCompanies.js';
import { matchSkillsInText } from '../data/skills.js';
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
  return result.jobs.slice(0,2);
}

export async function getJobDescription(company, jobId) {
  const response = await fetch(`${baseGreenhouseUrl}${company.toLowerCase()}/jobs/${jobId}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

export async function fetchGreenhouseJobs() {
  const companies = await defaultPgDao.getAllRows({
    tableName: 'companies',
    where: "platform = 'greenhouse'",
  });

  const companyPromises = companies.map(async (company) => {
    try {
      const jobs = await getJobs(company.namespace);
      const jobPromises = jobs.map(async (job) => {
        try {
          const desc = await getJobDescription(company.namespace, job.id);
          const sections = await parseGreenhouseJobDescription(desc.content);
          const sectionText = sections
            .map((s) => [s.heading, ...(s.content || [])].join(' '))
            .join('\n');
          const skills = matchSkillsInText(sectionText);
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
            skills: JSON.stringify(skills),
            updated_at: new Date().toISOString(),
          };
          return dbRow;
        } catch (error) {
          console.error(`Greenhouse: failed job ${job.id} (${company.name}):`, error.message);
          return null;
        }
      });
      const companyJobs = (await Promise.all(jobPromises)).filter((job) => job !== null);
      await insertGreenhouseJobsToDb(companyJobs);
      if (companyJobs.length > 0) {
        console.log(`Greenhouse: saved ${companyJobs.length} jobs for ${company.name}`);
      }
      return companyJobs.length;
    } catch (error) {
      console.error(`Greenhouse: failed company ${company.name}:`, error.message);
      return 0;
    }
  });

  const counts = await Promise.all(companyPromises);
  const totalSaved = counts.reduce((a, b) => a + b, 0);
  console.log(`Greenhouse: completed, total jobs saved: ${totalSaved}`);
  return { message: 'Fetched and stored greenhouse jobs successfully', count: totalSaved };
}

export async function insertGreenhouseJobsToDb(jobs) {
  if (!jobs || jobs.length === 0) return;

  const BATCH_SIZE = 50;
  const batches = [];

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    batches.push(jobs.slice(i, i + BATCH_SIZE));
  }

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
      job.skills,
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
