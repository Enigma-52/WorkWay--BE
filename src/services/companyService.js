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

  let processed = 0;
  let errors = 0;

  for (const company of companies) {
    try {
      const text = `${company.name} ${company.description || ''}`.trim();
      const response = await client.embeddings.create({
        model: 'openai/text-embedding-3-small',
        input: text,
      });
      const embedding = response.data[0].embedding;
      await companyDao.updateCompanyEmbedding(company.id, embedding);
      processed++;
      console.log(`Embedding generated for company ${company.id}: ${company.name}`);
    } catch (err) {
      errors++;
      console.error(`Failed to generate embedding for company ${company.id}:`, err.message);
    }
  }

  return { total: companies.length, processed, errors };
}
