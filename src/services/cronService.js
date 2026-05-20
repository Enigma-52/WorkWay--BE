import { greenhouseCompanies } from '../data/greenhouseCompanies.js';
import { leverCompanies } from '../data/leverCompanies.js';
import { ashbyCompanies } from '../data/ashbyCompanies.js';
import { workableCompanies } from '../data/workableCompanies.js';
import { ycCompanies } from '../data/ycCompanies.js';
import { matchSkillsInText } from '../data/skills.js';
import {
  parseGreenhouseJobDescription,
  getExperienceLevel,
  getEmploymentType,
  getJobDomain,
  normalizeLeverDescription,
  uuidToBase62,
  imgUploadToR2Buffer,
} from '../utils/helper.js';
import { defaultPgDao } from '../dao/dao.js';
import {
  ASHBY_ALL_COMPANY_JOBS_API_URL,
  ASHBY_HEADERS,
  ASHBY_ALL_COMPANY_JOBS_QUERY,
  ASHBY_SINGLE_JOB_URL,
  ASHBY_SINGLE_JOB_QUERY,
  ASHBY_SINGLE_COMPANY_URL,
  ASHBY_SINGLE_COMPANY_QUERY,
} from '../utils/constants.js';
import { mapWithConcurrency } from './dailyService.js';
import { fetchWithRetry } from '../utils/apiClient.js';
import pLimit from 'p-limit';
import axios from "axios";
import * as cheerio from "cheerio";
import he from "he";

const baseGreenhouseUrl = 'https://boards-api.greenhouse.io/v1/boards/';

export async function getJobs(company) {
  const response = await fetch(`${baseGreenhouseUrl}${company.toLowerCase()}/jobs`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const result = await response.json();
  // Return the first 5 jobs
  return result.jobs.slice(0, 2);
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
      if (!response.ok) {
        console.log('[GH-COMPANIES]   Skipped - Failed check');
        return null;
      }
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

  await insertCompaniesToDb(dedupedCompanies);

  return { message: 'Inserted greenhouse companies successfully', count: companies.length };
}

export async function insertCompaniesToDb(companies) {
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
    updateColumnNames: [],
    conflictColumns: ['slug'],
    returningCol: 'id',
  });
}

///// LEVER /////

export async function insertLeverCompanies() {
  const uniqueCompanies = [...new Set(leverCompanies)];
  const companyPromises = uniqueCompanies.map(async (company) => {
    try {
      const companyName = company;
      const companyDescription = 'No description available';

      const dbRow = {
        name: companyName,
        description: companyDescription,
        slug: companyName.toLowerCase().replace(/\s+/g, '-'),
        logo_url: `https://img.logo.dev/${company.toLowerCase()}.com?token=pk_VwiQaQgWRqm2uv-prQBDXw&format=png&theme=dark&retina=true`,
        location: JSON.stringify({}),
        website: null,
        platform: 'lever',
        namespace: company.toLowerCase(),
      };
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

  await insertCompaniesToDb(dedupedCompanies);

  return { message: 'Inserted lever companies successfully', count: companies.length };
}

export async function fetchLeverJobs() {
  const companies = await defaultPgDao.getAllRows({
    tableName: 'companies',
    where: "platform = 'lever'",
  });
  console.log('TOTAL ', companies.length);
  for (const company of companies) {
    const companyName = company.name;
    const apiUrl = `https://api.lever.co/v0/postings/${companyName.toLowerCase()}?mode=json`;
    try {
      const response = await fetch(apiUrl);
      const results = await response.json();
      if (!results || results.ok === false) {
        console.log('No jobs to fetch , skipping for ', companyName);
        continue;
      }
      const jobsArray = [];
      for (const job of results) {
        const desc = normalizeLeverDescription(job);
        const jobId = await uuidToBase62(job.id);
        const jobSlugRaw = company.slug + '-' + job.text + '-' + jobId;
        const jobSlug = jobSlugRaw
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        const [experience_level, employment_type, domain] = await Promise.all([
          getExperienceLevel(job.text),
          getEmploymentType(job.text),
          getJobDomain(job.text),
        ]);
        const dbRow = {
          company: company.name,
          company_id: company.id,
          slug: jobSlug,
          platform: 'lever',
          job_id: jobId,
          title: job.text,
          url: job.applyUrl,
          description: JSON.stringify(desc),
          experience_level,
          employment_type,
          domain,
          location: job.categories.location,
          skills: JSON.stringify([]),
          updated_at: new Date().toISOString(),
        };
        jobsArray.push(dbRow);
      }
      const insertedJobs = await insertLeverJobs(jobsArray);
      console.log('Inserting ', jobsArray.length, ' jobs into DB for ', companyName);
    } catch (error) {
      console.error(`Error fetching jobs for ${companyName}:`, error);
    }
  }
  return { message: 'Fetched lever jobs and inserted successfully' };
}

export async function insertLeverJobs(jobsArray) {
  const multiRowsColValuesList = jobsArray.map((job) => [
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function shuffleArray(arr) {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

export async function insertAshbyCompanies() {
  const uniqueCompanies = shuffleArray([
    ...new Set(ashbyCompanies.filter((company) => company && !company.includes('%20'))),
  ]);

  const BATCH_SIZE = 5;
  const COOLDOWN_MS = 3000;

  let insertedCount = 0;

  for (let i = 0; i < uniqueCompanies.length; i += BATCH_SIZE) {
    const batch = uniqueCompanies.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (company) => {
        try {
          const companyDetails = await getAshbyCompanyDetails(company);

          if (!companyDetails) {
            console.log(`Skipping ${company}: no data`);
            return null;
          }

          const companyName = companyDetails.name || company;

          return {
            name: companyName,
            description: 'No description available',
            slug: companyName.toLowerCase().replace(/\s+/g, '-'),
            logo_url: `https://img.logo.dev/${company.toLowerCase()}.com?token=pk_VwiQaQgWRqm2uv-prQBDXw&format=png&theme=dark&retina=true`,
            location: JSON.stringify({}),
            website: companyDetails.publicWebsite || null,
            platform: 'ashby',
            namespace: company.toLowerCase(),
          };
        } catch (error) {
          console.log(`Failed to fetch company ${company}: ${error.message}`);
          return null;
        }
      })
    );

    const validRows = batchResults.filter(Boolean);

    const bySlug = new Map();
    for (const row of validRows) {
      if (!bySlug.has(row.slug)) {
        bySlug.set(row.slug, row);
      }
    }

    const dedupedBatch = [...bySlug.values()];

    if (dedupedBatch.length > 0) {
      await insertCompaniesToDb(dedupedBatch);
      insertedCount += dedupedBatch.length;
    }

    console.log(
      `Processed ${Math.min(i + BATCH_SIZE, uniqueCompanies.length)} / ${uniqueCompanies.length} | Inserted: ${insertedCount}`
    );

    await sleep(COOLDOWN_MS);
  }

  return {
    message: 'Inserted ashby companies successfully',
    count: insertedCount,
  };
}

export async function getAshbyCompanyDetails(company) {
  const response = await fetchWithRetry(ASHBY_SINGLE_COMPANY_URL, {
    method: 'POST',
    headers: ASHBY_HEADERS,
    body: JSON.stringify({
      operationName: 'ApiOrganizationFromHostedJobsPageName',
      query: ASHBY_SINGLE_COMPANY_QUERY,
      variables: {
        organizationHostedJobsPageName: company,
        searchContext: 'JobBoard',
      },
    }),
  });
  return response?.data?.organization;
}

export async function fetchAshbyJobs() {
  console.log('Starting Ashby jobs ingestion');
  const companies = await defaultPgDao.getAllRows({
    tableName: 'companies',
    where: "platform = 'ashby'",
    orderBy: 'id ASC',
  });

  const total = companies.length;
  let index = 0;

  for (const company of companies) {
    index++;

    try {
      const existingJobs = await defaultPgDao.getAllRowsForChat({
        tableName: 'jobs',
        columns: ['job_id'],
        where: `company_id = ${company.id}`,
      });

      const jobIdsFromDB = new Set(existingJobs.map((row) => String(row.job_id)));

      const result = await getAshbyJobs(company.namespace);

      if (!Array.isArray(result)) {
        console.log(`Skipping ${company.namespace}: invalid response`);
        await sleep(2000);
        continue;
      }

      const apiJobIds = result.map((job) => String(job.id));

      const missingJobIds = apiJobIds.filter((id) => !jobIdsFromDB.has(id));

      if (missingJobIds.length > 0) {
        await processMissingJobsForCompanyAshby(missingJobIds, company);

        console.log(
          `Inserted ${missingJobIds.length} jobs for ${company.namespace} ${index}/${total}`
        );
      } else {
        console.log(`No missing jobs for ${company.namespace} ${index}/${total}`);
      }
    } catch (error) {
      console.log(`Failed company ${company.namespace}: ${error.message}`);
    }

    // VERY IMPORTANT
    await sleep(1500);
  }

  return { success: true };
}

export async function getAshbyJobs(company) {
  try {
    const response = await fetch(ASHBY_ALL_COMPANY_JOBS_API_URL, {
      method: 'POST',
      headers: ASHBY_HEADERS,
      body: JSON.stringify({
        operationName: 'ApiJobBoardWithTeams',
        query: ASHBY_ALL_COMPANY_JOBS_QUERY,
        variables: {
          organizationHostedJobsPageName: company,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Ashby API failed: ${response.status}`);
    }

    const data = await response.json();

    const jobs = data?.data?.jobBoard?.jobPostings || [];

    return jobs;
  } catch (error) {
    console.error(`Error fetching Ashby jobs for ${company}:`, error);
    return { jobs: [] }; // Return empty list on error to keep flow running
  }
}

export async function processMissingJobsForCompanyAshby(missingJobIds, company) {
  if (!missingJobIds.length) return;

  const BATCH_SIZE = 3;
  const COOLDOWN_MS = 2500;

  for (let i = 0; i < missingJobIds.length; i += BATCH_SIZE) {
    const batch = missingJobIds.slice(i, i + BATCH_SIZE);

    const jobsToInsert = await Promise.all(
      batch.map(async (jobId) => {
        try {
          const jobDetails = await getAshbyJobDetails(company.namespace, jobId);

          if (!jobDetails) return null;

          let sections = await parseGreenhouseJobDescription(jobDetails.descriptionHtml);

          const sectionText = sections
            .map((s) => [s.heading, ...(s.content || [])].join(' '))
            .join('\n');

          let compensationSection = [];

          if (jobDetails.compensationPhilosophyHtml) {
            compensationSection = await parseGreenhouseJobDescription(
              jobDetails.compensationPhilosophyHtml
            );

            if (compensationSection?.length) {
              compensationSection[0].heading = 'Compensation Summary';
              sections = sections.concat(compensationSection);
            }
          }

          const metadata = {
            compensation: jobDetails.compensationTierSummary || '',
          };

          const skills = matchSkillsInText(sectionText);

          const jobSlug = `${company.slug}-${jobDetails.title}-${jobDetails.id}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

          const [experience_level, employment_type, domain] = await Promise.all([
            getExperienceLevel(jobDetails.title),
            getEmploymentType(jobDetails.title),
            getJobDomain(jobDetails.title),
          ]);

          return [
            company.name,
            company.id,
            jobSlug,
            'ashby',
            jobDetails.id,
            jobDetails.title,
            `https://jobs.ashbyhq.com/${company.namespace}/${jobDetails.id}`,
            JSON.stringify(sections),
            experience_level,
            employment_type || jobDetails.employmentType,
            domain,
            jobDetails.locationName || 'Worldwide',
            JSON.stringify(skills),
            new Date().toISOString(),
            JSON.stringify(metadata),
          ];
        } catch (error) {
          console.log(`Failed job ${jobId}: ${error.message}`);
          return null;
        }
      })
    );

    const validRows = jobsToInsert.filter(Boolean);

    if (validRows.length) {
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
          'metadata',
        ],
        multiRowsColValuesList: validRows,
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
          'metadata',
        ],
        conflictColumns: ['slug'],
        returningCol: 'id',
      });
    }

    console.log(
      `Processed ${Math.min(
        i + BATCH_SIZE,
        missingJobIds.length
      )} / ${missingJobIds.length} jobs for ${company.name}`
    );

    await sleep(COOLDOWN_MS);
  }
}

export async function getAshbyJobDetails(company, jobId) {
  try {
    const data = await fetchWithRetry(ASHBY_SINGLE_JOB_URL, {
      method: 'POST',
      headers: ASHBY_HEADERS,
      body: JSON.stringify({
        operationName: 'ApiJobPosting',
        query: ASHBY_SINGLE_JOB_QUERY,
        variables: {
          organizationHostedJobsPageName: company,
          jobPostingId: jobId,
        },
      }),
    });

    return data?.data?.jobPosting || null;
  } catch (err) {
    console.error('getAshbyJobDetails error:', err);
    throw err;
  }
}

const baseWorkableUrl = 'https://apply.workable.com/api/v1/accounts/{company}?full=true';
const WORKABLE_COMPANY_REQUEST_TIMEOUT_MS = 12000;
const WORKABLE_COMPANY_MAX_RETRIES = 3;
const WORKABLE_COMPANY_RETRYABLE_STATUSES = new Set([403, 408, 425, 429, 500, 502, 503, 504]);

function stripHtmlToText(html = '') {
  return html
    .replace(/<\/p>/gi, '. ')
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\.\s*\./g, '.')
    .replace(/^\.\s*/, '')
    .replace(/\s*\.$/, '.')
    .trim();
}

async function fetchWorkableCompanyDetailsWithRetry(company, retries = WORKABLE_COMPANY_MAX_RETRIES) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKABLE_COMPANY_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(baseWorkableUrl.replace('{company}', company.toLowerCase()), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'WorkWayBot/1.0 (+https://www.workway.dev; company-ingestion)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const shouldRetry = retries > 0 && WORKABLE_COMPANY_RETRYABLE_STATUSES.has(response.status);
      if (shouldRetry) {
        const attempt = WORKABLE_COMPANY_MAX_RETRIES - retries + 1;
        await sleep(1000 * attempt);
        return fetchWorkableCompanyDetailsWithRetry(company, retries - 1);
      }

      const err = new Error(`Workable API failed: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    return response.json();
  } catch (error) {
    if (retries > 0) {
      const attempt = WORKABLE_COMPANY_MAX_RETRIES - retries + 1;
      await sleep(1000 * attempt);
      return fetchWorkableCompanyDetailsWithRetry(company, retries - 1);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}


export async function getWorkableCompanyDetails(company) {
  try {
    const data = await fetchWorkableCompanyDetailsWithRetry(company);
    return data;
  } catch (error) {
    if (error?.status === 404) {
      console.log(`Workable company board not found for ${company}`);
      return null;
    }
    if (error?.status === 403) {
      console.log(`Workable returned 403 for company ${company}; skipping for now`);
      return null;
    }
    console.error(`Error fetching Workable company details for ${company}:`, error.message);
    return null;
  }
}

export async function insertWorkableCompanies(){
  const uniqueCompanies = [...new Set(workableCompanies.filter(Boolean))];
  const existingWorkableCompanies = await defaultPgDao.getAllRows({
    tableName: 'companies',
    columns: ['namespace'],
    where: "platform = 'workable'",
  });
  const existingNamespaces = new Set(
    existingWorkableCompanies
      .map((row) => String(row.namespace || '').toLowerCase().trim())
      .filter(Boolean)
  );
  const companiesToInsert = uniqueCompanies.filter(
    (company) => !existingNamespaces.has(String(company).toLowerCase().trim())
  );
  const BATCH_SIZE = 5;
  const COOLDOWN_MS = 5000;

  let insertedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < companiesToInsert.length; i += BATCH_SIZE) {
    const batch = companiesToInsert.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (company) => {
        try {
          const companyDetails = await getWorkableCompanyDetails(company);

          if (!companyDetails) {
            console.log(`Skipping ${company}: no data`);
            return null;
          }

          const companyName = (companyDetails.name || company).trim();
          const companyWebsite = companyDetails.url || null;

          let description = 'No description available';
          if (companyDetails?.details?.overview?.description) {
            description = stripHtmlToText(companyDetails.details.overview.description) || description;
          }

          const companyLogoName = await extractDomain(companyWebsite) || company.toLowerCase() + '.com';
          const normalizedSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

          if (!normalizedSlug) {
            console.log(`Skipping ${company}: invalid slug after normalization`);
            return null;
          }

          return {
            name: companyName,
            description: description,
            slug: normalizedSlug,
            logo_url: `https://img.logo.dev/${companyLogoName}?token=pk_VwiQaQgWRqm2uv-prQBDXw&format=png&theme=dark&retina=true`,
            location: JSON.stringify({}),
            website: companyWebsite,
            platform: 'workable',
            namespace: company.toLowerCase(),
          };
        } catch (error) {
          failedCount += 1;
          console.log(`Failed to fetch company ${company}: ${error.message}`);
          return null;
        }
      })
    );

    const validRows = batchResults.filter(Boolean);

    const bySlug = new Map();
    for (const row of validRows) {
      if (!bySlug.has(row.slug)) {
        bySlug.set(row.slug, row);
      }
    }

    const dedupedBatch = [...bySlug.values()];

    if (dedupedBatch.length > 0) {
      await insertCompaniesToDb(dedupedBatch);
      insertedCount += dedupedBatch.length;
    }

    console.log(
      `Processed ${Math.min(i + BATCH_SIZE, companiesToInsert.length)} / ${companiesToInsert.length} | Inserted: ${insertedCount} | Failed: ${failedCount}`
    );

    await sleep(COOLDOWN_MS);
  }

  return {
    message: 'Inserted workable companies successfully',
    count: insertedCount,
    failed: failedCount,
    skipped_existing: uniqueCompanies.length - companiesToInsert.length,
  };
}

async function extractDomain(url) {
  try {
    // add protocol if missing
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

const YC_BASE_URL = "https://www.ycombinator.com";

export async function insertYCcompanies() {
  const uniqueCompanies = [...new Set(ycCompanies.filter(Boolean))];

  const results = [];

  for (const companyName of uniqueCompanies) {
    try {
      console.log(`Fetching: ${companyName}`);

      const companyData = await fetchYCCompanyDetails(companyName);

      results.push(companyData);
    } catch (error) {
      console.error(`Failed: ${companyName}`, error.message);
    }
  }

  await insertCompaniesToDb(results);
}

function buildCompanySlug(companyName) {
  return companyName
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

async function cleanText(text) {
  return text
    // replace escaped newlines/carriage returns
    .replace(/\\r\\n|\\n|\\r/g, ". ")
    
    // replace actual newlines/carriage returns
    .replace(/[\r\n]+/g, ". ")
    
    // collapse multiple dots/spaces
    .replace(/\.\s*\.+/g, ". ")
    .replace(/\s+/g, " ")
    
    // trim extra spaces
    .trim();
}

async function fetchYCCompanyDetails(companyName) {
  const slug = buildCompanySlug(companyName);

  const url = `${YC_BASE_URL}/companies/${slug}`;

  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36",
    },
  });

  const $ = cheerio.load(response.data);

  const rawPayload = $("div[data-page]").attr("data-page");

  if (!rawPayload) {
    throw new Error(`No embedded payload found for ${companyName}`);
  }

  const parsed = JSON.parse(he.decode(rawPayload));
  const company = parsed?.props?.company || {};


  const banner_logo = await imgUploadToR2Buffer(company?.logo_url , `${slug}-banner-logo`)

  const founders = await Promise.all(
    (company?.founders || []).map(async (founder) => ({
      name: founder?.full_name,
      title: founder?.title,
      bio: await cleanText(founder?.founder_bio),
      image: founder?.avatar_thumb_url,
      social: {
        linkedin: founder?.linkedin_url,
        twitter: founder?.twitter_url,
      },
    }))
  );

  const metadata = {
    ycBatch : company?.batch,
    foundedYear : company?.year_founded,
    teamSize : company?.team_size,
    status : company?.ycdc_status,
    tagline : company?.one_liner,
    banner_logo : banner_logo,
    social : {
      linkedin : company?.linkedin_url,
      twitter : company?.twitter_url,
      github : company?.github_url,
      facebook : company?.fb_url,
      crunchbase : company?.cb_url,
    },
    tags : company?.tags || [],
    ycPartner: company?.primary_group_partner || false,
    founders
  };

  const companyDetails = {
    name: company.name,
    slug: slug,
    description: await cleanText(company.long_description) || "No description available",
    website: company.website,
    logo_url: company.small_logo_url || `https://img.logo.dev/${company.website}?token=pk_VwiQaQgWRqm2uv-prQBDXw&format=png&theme=dark&retina=true`,
    metadata,
    platform: "ycombinator",
    namespace: toLowerCase(company.name),
  };

  return companyDetails;
}