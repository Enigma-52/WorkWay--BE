import { defaultPgDao } from '../dao/dao.js';
import { jobsDao } from '../dao/jobsDao.js';

export async function getCompanyDetails(slug) {
  try {
    const companyDetails = await defaultPgDao.getRow({
      tableName: 'companies',
      where: { slug },
    });
    const companyId = companyDetails ? companyDetails.id : null;
    console.log(companyId);
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
