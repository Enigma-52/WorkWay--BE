import { defaultPgDao } from '../dao/dao.js';
import { fetchWithRetry } from '../utils/apiClient.js';
import { jobsDao } from '../dao/jobsDao.js';
import {
  parseGreenhouseJobDescription,
  getExperienceLevel,
  getEmploymentType,
  getJobDomain,
} from '../utils/helper.js';
import { matchSkillsInText, slugify } from '../data/skills.js';
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
  console.log(`Found ${c} YC companies in DB`);
  if (c === 0) {
    console.log('No YC companies found. Run /insert_yc_companies first.');
    return { success: false, message: 'No YC companies in DB' };
  }
  let t = 0;
  for (const company of companies) {
    t += 1;
    try {
      const getJobsForCompanyFromDB = await defaultPgDao.getAllRowsForChat({
        tableName: 'jobs',
        columns: ['slug'],
        where: `company_id = ${company.id}`,
      });
      const jobSlugsFromDB = new Set(
        getJobsForCompanyFromDB.map((row) => row.slug)
      );

      const result = await getYCJobs(company.namespace);

      console.log(`Fetched ${result.length} YC jobs for ${company.namespace} (${t}/${c})`);

      // extract slug from YC URL
      const apiJobSlugs = result.map((job) => {
        return job.url.split("/jobs/")[1];
      });

      // jobs not present in DB
      const missingJobSlugs = apiJobSlugs.filter(
        (slug) => !jobSlugsFromDB.has(slug)
      );

      if (missingJobSlugs.length == 0) continue;
      console.log(`Missing slugs for ${company.namespace}:`, missingJobSlugs);
      const one = missingJobSlugs[0];
      await processMissingYCForCompany([one], company);
      await sleep(5000); // be nice to YC
      console.log('Inserted ', missingJobSlugs.length, ' jobs for ', company.namespace, ' ', t, '/', c);
    } catch (err) {
      console.error(`Failed processing YC company ${company.namespace} (${t}/${c}):`, err.message);
      continue;
    }
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

export async function processMissingYCForCompany(
  missingJobSlugs,
  company
) {
  // process in batches of 2
  const BATCH_SIZE = 2;

  for (let i = 0; i < missingJobSlugs.length; i += BATCH_SIZE) {
    const batch = missingJobSlugs.slice(i, i + BATCH_SIZE);

    try {
      // run 2 jobs concurrently
      await Promise.all(
        batch.map(async (jobSlug) => {
          try {
            await fetchAndStoreYCJob(jobSlug, company);

          } catch (err) {
            console.error(
              `Failed YC job ${jobSlug} for ${company.namespace}`,
              err.message
            );
          }
        })
      );
    } catch (err) {
      console.error(
        `Batch failed for ${company.namespace}`,
        err.message
      );
    }

    // wait 5s before next batch
    if (i + BATCH_SIZE < missingJobSlugs.length) {
      console.log("Sleeping for 5 seconds...");
      await sleep(5000);
    }
  }
}

async function fetchAndStoreYCJob(jobSlug , company) {
  const url = `https://www.ycombinator.com/companies/${company.namespace}/jobs/${jobSlug}`;

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0.0 Safari/537.36",
  };

  try {
    const response = await axios.get(url, { headers });

    const $ = cheerio.load(response.data);

    const rawData = $("div[data-page]").attr("data-page");

    if (!rawData) {
      throw new Error("Could not find embedded payload");
    }

    // decode html entities
    const decoded = he.decode(rawData);

    // parse JSON
    const pageJson = JSON.parse(decoded);

    // extract only job object
    const job = pageJson?.props?.job;

    await storeYCJob(job,company);
    return { success: true };
  } catch (err) {
    console.error(
      `Failed fetching YC job ${jobSlug}`,
      err.message
    );

    return null;
  }
}

/**
 * Resolve raw skill names (from YC) to { name, slug } objects.
 * Looks up each name in the skills table; if not found, creates a new entry.
 */
async function resolveYCSkills(rawSkills) {
  if (!Array.isArray(rawSkills) || rawSkills.length === 0) return [];

  const resolved = [];
  for (const raw of rawSkills) {
    const name = typeof raw === 'string' ? raw.trim() : raw?.name?.trim?.();
    if (!name) continue;

    const slug = slugify(name);

    // Check if skill exists in DB
    const existing = await defaultPgDao.getQ({
      sql: `SELECT name, slug FROM skills WHERE slug = $1 LIMIT 1`,
      values: [slug],
    });

    if (existing.length > 0) {
      resolved.push({ name: existing[0].name, slug: existing[0].slug });
    } else {
      // Insert new skill
      try {
        await defaultPgDao.getQ({
          sql: `INSERT INTO skills (name, slug, skill_group_type, skill_group_name, skill_group_slug)
                VALUES ($1, $2, 'other', 'Other', 'other')
                ON CONFLICT DO NOTHING`,
          values: [name, slug],
        });
      } catch (err) {
        console.error(`Failed to insert skill "${name}":`, err.message);
      }
      resolved.push({ name, slug });
    }
  }

  return resolved;
}

export async function storeYCJob(job, company) {

  const desc = await parseYCJobDescription(job.description);
  let skills = await resolveYCSkills(job.skills);

  // If YC didn't provide skills, extract them from the job description
  if (skills.length === 0 && desc.length > 0) {
    const sectionText = desc
      .map((s) => [s.heading, ...(s.content || [])].join(' '))
      .join('\n');
    skills = matchSkillsInText(sectionText);
  }

  const [experience_level, employment_type, domain] = await Promise.all([
    getExperienceLevel(job.title),
    getEmploymentType(job.title),
    getJobDomain(job.title),
  ]);

  const metdata = {
    role : job.prettyRole,
    salaryRange : job.salaryRange,
    equityRange : job.equityRange,
    minExperience : job.minExperience,
    minSchoolYear : job.minSchoolYear,
    visa : job.visa,
  }

  const jobRow = {
    company_id: company.id,
    company : company.name,
    slug : job.url.split("/jobs/")[1],
    platform : 'ycombinator',
    job_id : job.id,
    title : job.title,
    url : "https://www.workatastartup.com/jobs/" + job.id,
    description : JSON.stringify(desc),
    experience_level,
    employment_type,
    domain,
    location : job.location || 'Worldwide',
    skills : JSON.stringify(skills),
    metadata : JSON.stringify(metdata),
    updated_at: new Date().toISOString(),
  };
  await insertYCjobRowIntoDB(jobRow);
}

export async function insertYCjobRowIntoDB(jobRow) {
  const columnNames = [
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
    'metadata',
    'updated_at',
  ];

  const multiRowsColValuesList = [
    columnNames.map((col) => jobRow[col]),
  ];

  try {
    await defaultPgDao.insertOrUpdateMultipleObjs({
      tableName: 'jobs',
      columnNames,
      multiRowsColValuesList,
      conflictColumns: ['slug'],
      updateColumnNames: [
        'title',
        'url',
        'description',
        'experience_level',
        'employment_type',
        'domain',
        'location',
        'skills',
        'metadata',
        'updated_at',
      ],
      returningCol: 'id',
    });
  } catch (error) {
    console.error('Error inserting YC job into DB:', error.message);
  }
}

export async function parseYCJobDescription(description) {
  if (!description) return [];

  const lines = description
    .replace(/\r\n/g, "\n")
    .split("\n");

  const sections = [];

  let currentSection = {
    heading: "Overview",
    content: [],
  };

  const pushCurrentSection = () => {
    if (currentSection.content.length > 0) {
      sections.push({
        heading: currentSection.heading,
        content: currentSection.content,
      });
    }
  };

  for (let rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    /**
     * Detect REAL section headings only:
     *
     * ✅ **The Role**
     * ✅ **What You'll Do:**
     *
     * NOT:
     * ❌ Since launch **$100M ARR**
     */

    const headingMatch = line.match(/^\*\*(.+?)\*\*$/);

    if (headingMatch) {
      pushCurrentSection();

      currentSection = {
        heading: headingMatch[1]
          .replace(/:$/, "")
          .trim(),
        content: [],
      };

      continue;
    }

    // remove inline markdown bold
    const cleaned = line.replace(/\*\*(.*?)\*\*/g, "$1");

    currentSection.content.push(cleaned);
  }

  pushCurrentSection();

  return sections;
}