import { defaultPgDao } from '../dao/dao.js';
import { jobsDao } from '../dao/jobsDao.js';
import { companyDao } from '../dao/companyDao.js';
import OpenAI from 'openai';

export async function getCompanyDetails(slug) {
  try {
    const companyDetails = await defaultPgDao.getRow({
      tableName: 'companies',
      where: { slug },
    });
    const companyId = companyDetails ? companyDetails.id : null;
    const jobDetails = await jobsDao.getCompanyJobFeed({ companyId });
    const recentlyPostedJobs = await jobsDao.getCompanyRecentlyPostedJobs({ companyId });
    const enrichedCompanyDetails = {
      ...companyDetails,
      jobListings: jobDetails,
      recentlyPostedJobs: recentlyPostedJobs
    };
    return enrichedCompanyDetails;
  } catch (error) {
    console.error(`Failed to fetch details for company with slug ${slug}:`, error);
    throw error;
  }
}

export async function getAllCompanies(params) {
  const { q, page, limit, letter, hiring } = params;
  const companies = await companyDao.getAllCompanies({ q, page, limit, letter, hiring });
  return companies;
}

export async function getCompanyOverview() {
  return companyDao.getOverview();
}

const BATCH_CONCURRENCY = 50;

export async function generateCompanyEmbeddings() {
  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL,
      'X-Title': process.env.OPENROUTER_SITE_NAME,
    },
  });

  const companies = await companyDao.getCompaniesWithoutEmbeddings();
  if (companies.length === 0) {
    return { processed: 0, message: 'All companies already have embeddings' };
  }

  console.log(`Found ${companies.length} companies without embeddings. Processing in batches of ${BATCH_CONCURRENCY}...`);

  let processed = 0;
  let errors = 0;

  for (let i = 0; i < companies.length; i += BATCH_CONCURRENCY) {
    const batch = companies.slice(i, i + BATCH_CONCURRENCY);

    // Batch embed call — send all texts in one API request
    const texts = batch.map(c => `${c.name} ${c.description || ''}`.trim());
    try {
      const response = await client.embeddings.create({
        model: 'openai/text-embedding-3-small',
        input: texts,
      });

      // Save all embeddings in parallel
      const saveResults = await Promise.allSettled(
        response.data.map((item, idx) =>
          companyDao.updateCompanyEmbedding(batch[idx].id, item.embedding)
        )
      );

      for (let j = 0; j < saveResults.length; j++) {
        if (saveResults[j].status === 'fulfilled') {
          processed++;
        } else {
          errors++;
          console.error(`Failed to save embedding for company ${batch[j].id}:`, saveResults[j].reason?.message);
        }
      }

      console.log(`Batch ${Math.floor(i / BATCH_CONCURRENCY) + 1}: ${batch.length} embeddings generated (${processed} total)`);
    } catch (err) {
      // If the batch API call itself fails, fall back to individual calls
      console.error(`Batch embed failed, falling back to individual calls:`, err.message);
      const results = await Promise.allSettled(
        batch.map(async (company) => {
          const text = `${company.name} ${company.description || ''}`.trim();
          const res = await client.embeddings.create({
            model: 'openai/text-embedding-3-small',
            input: text,
          });
          await companyDao.updateCompanyEmbedding(company.id, res.data[0].embedding);
        })
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          processed++;
        } else {
          errors++;
          console.error(`Failed embedding for company ${batch[j].id}:`, results[j].reason?.message);
        }
      }
    }
  }

  return { total: companies.length, processed, errors };
}
