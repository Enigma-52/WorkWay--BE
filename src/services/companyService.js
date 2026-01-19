import { defaultPgDao } from '../dao/dao.js';
import { jobsDao } from '../dao/jobsDao.js';
import { companyDao } from '../dao/companyDao.js';

export async function getCompanyDetails(slug) {
  try {
    const companyDetails = await defaultPgDao.getRow({
      tableName: 'companies',
      where: { slug },
    });
    const companyId = companyDetails ? companyDetails.id : null;
    const jobDetails = await jobsDao.getCompanyJobFeed({ companyId });
    const enrichedCompanyDetails = {
      ...companyDetails,
      jobListings: jobDetails,
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
