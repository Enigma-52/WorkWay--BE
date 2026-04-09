import { greenhouseCompanies } from '../data/greenhouseCompanies.js';
import { leverCompanies } from '../data/leverCompanies.js';
import { ashbyCompanies } from '../data/ashbyCompanies.js';
import { matchSkillsInText } from '../data/skills.js';
import {
  parseGreenhouseJobDescription,
  getExperienceLevel,
  getEmploymentType,
  getJobDomain,
  normalizeLeverDescription,
  uuidToBase62
} from '../utils/helper.js';
import { defaultPgDao } from '../dao/dao.js';
import { ASHBY_ALL_COMPANY_JOBS_API_URL , ASHBY_HEADERS , ASHBY_ALL_COMPANY_JOBS_QUERY , ASHBY_SINGLE_JOB_URL , ASHBY_SINGLE_JOB_QUERY} from '../utils/constants.js';
import { mapWithConcurrency } from './dailyService.js';
import { fetchWithRetry } from '../utils/apiClient.js';

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
      if (!response.ok){
        console.log("[GH-COMPANIES]   Skipped - Failed check");
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
  console.log("TOTAL " , companies.length )
  for (const company of companies) {
    const companyName = company.name;
    const apiUrl = `https://api.lever.co/v0/postings/${companyName.toLowerCase()}?mode=json`;
    try {
      const response = await fetch(apiUrl);
      const results = await response.json();
      if (!results || results.ok === false) {
        console.log("No jobs to fetch , skipping for " , companyName)
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
      const insertedJobs = await insertLeverJobs(jobsArray)
      console.log("Inserting " , jobsArray.length , " jobs into DB for " , companyName)
    } catch (error) {
      console.error(`Error fetching jobs for ${companyName}:`, error);
    }
  }
  return { message: 'Fetched lever jobs and inserted successfully' };
}

export async function insertLeverJobs(jobsArray)
{
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

export async function insertAshbyCompanies() {
  const uniqueCompanies = [...new Set(ashbyCompanies)];
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
        platform: 'ashby',
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

  return { message: 'Inserted ashby companies successfully', count: companies.length };

}

export async function fetchAshbyJobs() {
  // Placeholder for Ashby job fetching logic
  const companies = await defaultPgDao.getAllRows({
    tableName: 'companies',
    where: "platform = 'ashby' and name = 'OpenAI'",
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
    const result = await getAshbyJobs(company.namespace);
    const apiJobIds = result.map((job) => String(job.id));
    const missingJobIds = apiJobIds.filter((id) => !jobIdsFromDB.has(id));
    t += 1;
    if (missingJobIds.length == 0) continue;
    console.log(missingJobIds.length);
    const testingJobId = missingJobIds[0];
    await processMissingJobsForCompanyAshby([testingJobId], company);
    console.log('Inserted ', missingJobIds.length, ' jobs for ', company.namespace, ' ', t, '/', c);
  }
  return { success: 'true' };
}

export async function getAshbyJobs(company) {
try {
  const response = await fetch(ASHBY_ALL_COMPANY_JOBS_API_URL, {
      method: "POST",
      headers: ASHBY_HEADERS,
      body: JSON.stringify({
        operationName: "ApiJobBoardWithTeams",
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

  const concurrency = 5; // safe small boost

  const jobsToInsert = await mapWithConcurrency(missingJobIds, concurrency, async (jobId) => {
    const jobDetails = await getAshbyJobDetails(company.namespace, jobId);

    let sections = await parseGreenhouseJobDescription(jobDetails.descriptionHtml);
    const sectionText = sections.map((s) => [s.heading, ...(s.content || [])].join(' ')).join('\n');

    let compensationSection = [];
    
    if (jobDetails.compensationPhilosophyHtml) {
      compensationSection = await parseGreenhouseJobDescription(jobDetails.compensationPhilosophyHtml) || '';
      compensationSection[0].heading = 'Compensation Summary';
      sections = sections.concat(compensationSection);
    }

    const compensationText = jobDetails.compensationTierSummary || '' ;
    const metadata = {
      compensation : compensationText,
    }

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

    const jobUrl = `https://jobs.ashbyhq.com/${company.namespace}/${jobDetails.id}`;

    return {
      company: company.name,
      company_id: company.id,
      slug: jobSlug,
      platform: 'ashby',
      job_id: jobDetails.id,
      title: jobDetails.title,
      url: jobUrl,
      description: JSON.stringify(sections),
      experience_level,
      employment_type : employment_type || jobDetails.employmentType, 
      domain,
      location: jobDetails.locationName || 'Worldwide',
      skills: JSON.stringify(skills),
      updated_at: new Date().toISOString(),
      metadata: JSON.stringify(metadata),
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
    job.metadata,
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
        'metadata',
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
        'metadata',
      ],
      conflictColumns: ['slug'],
      returningCol: 'id',
    });
  } catch (error) {
    console.log(error);
  }
}

export async function getAshbyJobDetails(company, jobId) {
  try {
    const data = await fetchWithRetry(ASHBY_SINGLE_JOB_URL, {
      method: "POST",
      headers: ASHBY_HEADERS,
      body: JSON.stringify({
        operationName: "ApiJobPosting",
        query: ASHBY_SINGLE_JOB_QUERY,
        variables: {
          organizationHostedJobsPageName: company,
          jobPostingId: jobId,
        },
      }),
    });

    return data?.data?.jobPosting || null;
  } catch (err) {
    console.error("getAshbyJobDetails error:", err);
    throw err;
  }
}