import { defaultPgDao } from '../dao/dao.js';

export async function getJobDetails(slug) {
  try {
    const jobDetails = await defaultPgDao.getRow({
      tableName: 'jobs',
      where: { slug },
    });

    const jobDomain = jobDetails.domain;
    const domainJobs = await defaultPgDao.getAllRows({
      tableName: 'jobs',
      where: `domain = '${jobDomain}' AND slug != '${slug}'`,
    });

    const companyJobs = await defaultPgDao.getAllRows({
      tableName: 'jobs',
      where: `company = '${jobDetails.company}' AND slug != '${slug}'`,
    });

    // Truncate to only include specific fields
    const truncatedDomainJobs = domainJobs.map((job) => ({
      company: job.company,
      title: job.title,
      slug: job.slug,
      location: job.location,
      employment_type: job.employment_type,
    }));

    const truncatedCompanyJobs = companyJobs.map((job) => ({
      company: job.company,
      title: job.title,
      slug: job.slug,
      location: job.location,
      employment_type: job.employment_type,
    }));

    const enrichedJobDetails = {
      ...jobDetails,
      similarJobsByDomain: truncatedDomainJobs,
      otherJobsByCompany: truncatedCompanyJobs,
    };

    return enrichedJobDetails;
  } catch (error) {
    console.error(`Failed to fetch details for job with slug ${slug}:`, error);
    throw error;
  }
}
