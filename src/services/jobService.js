import { defaultPgDao } from '../dao/dao.js';
import { jobsDao } from '../dao/jobsDao.js';

export async function getJobDetails(slug) {
  try {
    const jobDetails = await jobsDao.getSingleJob({ slug });

    const jobDomain = jobDetails[0].domain;
    const domainJobs = await jobsDao.getDomainJobwithExclusion({
      domain: jobDomain,
      excludeSlug: slug,
    });

    const companyJobs = await jobsDao.getCompanyJobwithExclusion({
      company: jobDetails[0].company,
      excludeSlug: slug,
    });

    const enrichedJobDetails = {
      ...jobDetails[0],
      similarJobsByDomain: domainJobs,
      otherJobsByCompany: companyJobs,
    };

    return enrichedJobDetails;
  } catch (error) {
    console.error(`Failed to fetch details for job with slug ${slug}:`, error);
    throw error;
  }
}
