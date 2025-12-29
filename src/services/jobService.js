import { defaultPgDao } from '../dao/dao.js';

export async function getJobDetails(slug) {
  try {
    const jobDetails = await defaultPgDao.getRow({
      tableName: 'jobs',
      where: { slug },
    });
    return jobDetails;
  } catch (error) {
    console.error(`Failed to fetch details for job with slug ${slug}:`, error);
    throw error;
  }
}
