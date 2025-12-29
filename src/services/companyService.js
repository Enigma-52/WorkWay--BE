import { defaultPgDao } from '../dao/dao.js';

export async function getCompanyDetails(slug) {
  try {
    const companyDetails = await defaultPgDao.getRow({
      tableName: 'companies',
      where: { slug },
    });
    return companyDetails;
  } catch (error) {
    console.error(`Failed to fetch details for company with slug ${slug}:`, error);
    throw error;
  }
}
