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
import axios from 'axios';
import * as cheerio from 'cheerio';
import he from 'he';

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
    orderBy : 'id ASC',
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

export async function processMissingForCompany(missingJobIds, company) {
  if (!missingJobIds.length) return;

  const concurrency = 5; // safe small boost

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

export async function mapWithConcurrency(items, limit, asyncFn) {
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

const baseWorkableJobsUrl = 'https://apply.workable.com/api/v3/accounts/{company}/jobs'
const baseWorkableJobDetailUrl = 'https://apply.workable.com/api/v2/accounts/{company}/jobs/{job_id}'
const WORKABLE_REQUEST_TIMEOUT_MS = 12000;
const WORKABLE_MAX_RETRIES = 3;
const WORKABLE_COMPANY_COOLDOWN_MS = 1500;
const WORKABLE_RETRYABLE_STATUSES = new Set([403, 408, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWorkableJsonWithRetry(url, options = {}, retries = WORKABLE_MAX_RETRIES) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKABLE_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'WorkWayBot/1.0 (+https://workway.dev; jobs-ingestion)',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const shouldRetry = retries > 0 && WORKABLE_RETRYABLE_STATUSES.has(response.status);
      if (shouldRetry) {
        const attempt = WORKABLE_MAX_RETRIES - retries + 1;
        const backoff = 1000 * attempt;
        await sleep(backoff);
        return fetchWorkableJsonWithRetry(url, options, retries - 1);
      }

      const err = new Error(`Workable HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }

    return response.json();
  } catch (err) {
    if (retries > 0) {
      const attempt = WORKABLE_MAX_RETRIES - retries + 1;
      const backoff = 1000 * attempt;
      await sleep(backoff);
      return fetchWorkableJsonWithRetry(url, options, retries - 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function insertWorkableJobsDaily() {
  console.log('Starting Workable jobs ingestion');
  const companies = await defaultPgDao.getAllRows({
    tableName: 'companies',
    where: "platform = 'workable'",
    orderBy : 'id DESC',
  });
  const c = companies.length;
  let t = 0;

  for (const company of companies) {
    t += 1;

    try {
      const getJobsForCompanyFromDB = await defaultPgDao.getAllRowsForChat({
        tableName: 'jobs',
        columns: ['job_id'],
        where: `company_id = ${company.id}`,
      });

      const jobIdsFromDB = new Set(getJobsForCompanyFromDB.map((row) => String(row.job_id)));
      const result = await getWorkableJobs(company.namespace);
      const apiJobIds = result.jobs.map((job) => String(job.shortcode)).filter(Boolean);
      const missingJobIds = apiJobIds.filter((id) => !jobIdsFromDB.has(id));

      if (missingJobIds.length === 0) {
        console.log(`No missing Workable jobs for ${company.namespace} ${t}/${c}`);
        await sleep(WORKABLE_COMPANY_COOLDOWN_MS);
        continue;
      }

      await processMissingWorkableJobsForCompany(missingJobIds, company);
      console.log(`Inserted ${missingJobIds.length} Workable jobs for ${company.namespace} ${t}/${c}`);
    } catch (error) {
      console.error(`Failed Workable company ${company.namespace}:`, error.message);
    }

    await sleep(WORKABLE_COMPANY_COOLDOWN_MS);
  }
  return { success: true };
}

export async function getWorkableJobs(company) {
  try {
    const url = baseWorkableJobsUrl.replace('{company}', company.toLowerCase());
    const response = await fetchWorkableJsonWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const jobs = Array.isArray(response?.results) ? response.results : [];
    return { jobs };
  } catch (err) {
    if (err?.status === 404 || err?.message?.includes('404')) {
      console.log(`Workable board not found for ${company}`);
      return { jobs: [] };
    }

    if (err?.status === 403 || err?.message?.includes('403')) {
      console.log(`Workable returned 403 for ${company}; skipping for now`);
      return { jobs: [] };
    }

    console.error(`Workable fetch failed for ${company}`, err.message);
    return { jobs: [] };
  }
}

export async function processMissingWorkableJobsForCompany(missingJobIds, company) {
  if (!missingJobIds.length) return;

  const BATCH_SIZE = 3;
  const COOLDOWN_MS = 2500;

  const jobsToInsert = [];

  for (let i = 0; i < missingJobIds.length; i += BATCH_SIZE) {
    const batch = missingJobIds.slice(i, i + BATCH_SIZE);
    const batchRows = await Promise.all(
      batch.map(async (jobId) => {
        try {
          const jobUrl = baseWorkableJobDetailUrl
            .replace('{company}', company.namespace.toLowerCase())
            .replace('{job_id}', jobId);
          const jobDetails = await fetchWorkableJsonWithRetry(jobUrl);

          if (!jobDetails?.shortcode || !jobDetails?.title) return null;

          const jobSlugRaw = company.slug + '-' + jobDetails.title + '-' + jobDetails.shortcode;

          const sections = await parseGreenhouseJobDescription(jobDetails.description || '');
          const sectionText = sections.map((s) => [s.heading, ...(s.content || [])].join(' ')).join('\n');
          const skills = matchSkillsInText(sectionText);

          const [experience_level, employment_type, domain] = await Promise.all([
            getExperienceLevel(jobDetails.title),
            getEmploymentType(jobDetails.title),
            getJobDomain(jobDetails.title),
          ]);

          const locationCity = jobDetails?.location?.city || '';
          const locationCountry = jobDetails?.location?.country || '';
          const locationString = [locationCity, locationCountry].filter(Boolean).join(', ');

          const jobSlug = jobSlugRaw
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

          const jobAbsoluteUrl = `https://apply.workable.com/${company.namespace.toLowerCase()}/j/${jobDetails.shortcode}/`;

          return {
            company: company.name,
            company_id: company.id,
            slug: jobSlug,
            platform: 'workable',
            job_id: jobDetails.shortcode,
            title: jobDetails.title,
            url: jobAbsoluteUrl,
            description: JSON.stringify(sections),
            experience_level: experience_level,
            employment_type: employment_type,
            domain: domain,
            location: locationString || 'Worldwide',
            skills: JSON.stringify(skills),
            updated_at: new Date().toISOString(),
          };
        } catch (err) {
          console.error(`Failed to fetch details for Workable job ${jobId} of company ${company.namespace}`, err.message);
          return null;
        }
      })
    );

    jobsToInsert.push(...batchRows.filter(Boolean));
    console.log(
      `Processed ${Math.min(i + BATCH_SIZE, missingJobIds.length)} / ${missingJobIds.length} Workable jobs for ${company.namespace}`
    );
    await sleep(COOLDOWN_MS);
  }

  const validJobsToInsert = jobsToInsert.filter(Boolean);

  if (validJobsToInsert.length === 0) {
    console.log(`No valid Workable jobs to insert for company ${company.namespace}`);
    return;
  }

  const multiRowsColValuesList = validJobsToInsert.map((job) => [
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

export async function insertYCJobsDaily() {
  const companies = await defaultPgDao.getAllRows({
    tableName: 'companies',
    where: "platform = 'ycombinator'",
    orderBy : 'id ASC',
  });
  const c = companies.length;
  let t = 0;
  for (const company of companies) {
    const getJobsForCompanyFromDB = await defaultPgDao.getAllRowsForChat({
      tableName: 'jobs',
      columns: ['job_id'],
      where: `company_id = ${company.id}`,
    });
    const jobIdsFromDB = new Set(getJobsForCompanyFromDB.map((row) => row.job_id));
    const result = await getYCJobs(company.namespace);
    return result;
    const apiJobIds = result.jobs.map((job) => String(job.id));
    const missingJobIds = apiJobIds.filter((id) => !jobIdsFromDB.has(id));
    t += 1;
    if (missingJobIds.length == 0) continue;
    await processMissingYCForCompany(missingJobIds, company);
    console.log('Inserted ', missingJobIds.length, ' jobs for ', company.namespace, ' ', t, '/', c);
  }
  return { success: 'true' };
}

export async function getYCJobs(companyName) {
  const url = `https://www.ycombinator.com/companies/${companyName}/jobs`;

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0.0 Safari/537.36",
  };

  try {
    // Fetch page
    const response = await axios.get(url, { headers });

    // Parse HTML
    const $ = cheerio.load(response.data);

    // Find div with embedded JSON
    const rawData = $("div[data-page]").attr("data-page");

    if (!rawData) {
      throw new Error("Could not find data-page payload");
    }

    // Decode HTML entities
    const decoded = he.decode(rawData);

    // Parse JSON
    const data = JSON.parse(decoded);

    // Extract jobs
    const jobs = data?.props?.jobPostings || [];
    return jobs;
  } catch (err) {
    console.error("Error fetching YC jobs:", err.message);
    throw err;
  }
}

export async function processMissingYCForCompany(missingJobIds, company) {
}