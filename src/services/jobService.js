import { jobsDao, DEFAULT_LIMIT, MAX_LIMIT } from '../dao/jobsDao.js';
import { getSkillBySlug } from '../data/skills.js';
import { JOB_DOMAINS, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from '../utils/constants.js';
import { pickRelevantDescriptionSections } from '../utils/helper.js';

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

const SORT_VALUES = ['recent'];

/**
 * Normalizes and validates list query params. Returns either { filters, page, limit, sort } or { error, status, message }.
 * @param {{ q?: string, page?: string|number, limit?: string|number, sort?: string, domain?: string, employment_type?: string, experience_level?: string, location?: string, company_slug?: string, skill?: string, skill_slug?: string }} query
 */
export function normalizeAndValidateListParams(query) {
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  const sort = SORT_VALUES.includes(query.sort) ? query.sort : 'recent';

  const skillSlugRaw = typeof (query.skill ?? query.skill_slug) === 'string' ? String(query.skill ?? query.skill_slug).trim().toLowerCase() : '';
  const skill_slug = skillSlugRaw === '' ? null : skillSlugRaw;

  const domainRaw = typeof query.domain === 'string' ? query.domain.trim().toLowerCase() : 'all';
  let domainName = null;
  if (domainRaw && domainRaw !== 'all') {
    const domainObj = JOB_DOMAINS.find((d) => d.slug === domainRaw);
    if (!domainObj) {
      return {
        error: true,
        status: 400,
        message: `Invalid domain: ${query.domain}. Use a valid slug or 'all'.`,
      };
    }
    domainName = domainObj.name;
  }

  const employmentTypeRaw = typeof query.employment_type === 'string' ? query.employment_type.trim() : 'all';
  let employmentType = null;
  if (employmentTypeRaw && employmentTypeRaw !== 'all') {
    const matched = EMPLOYMENT_TYPES.find((v) => v.toLowerCase() === employmentTypeRaw.toLowerCase());
    if (!matched) {
      return {
        error: true,
        status: 400,
        message: `Invalid employment_type: ${query.employment_type}. Allowed: ${EMPLOYMENT_TYPES.join(', ')}, or 'all'.`,
      };
    }
    employmentType = matched;
  }

  const experienceLevelRaw = typeof query.experience_level === 'string' ? query.experience_level.trim() : 'all';
  let experienceLevel = null;
  if (experienceLevelRaw && experienceLevelRaw !== 'all') {
    const matched = EXPERIENCE_LEVELS.find((v) => v.toLowerCase() === experienceLevelRaw.toLowerCase());
    if (!matched) {
      return {
        error: true,
        status: 400,
        message: `Invalid experience_level: ${query.experience_level}. Allowed: ${EXPERIENCE_LEVELS.join(', ')}, or 'all'.`,
      };
    }
    experienceLevel = matched;
  }

  const location = typeof query.location === 'string' ? query.location.trim() : '';
  const companySlug = typeof query.company_slug === 'string' ? query.company_slug.trim() : '';

  const filters = {
    q: q || null,
    domain: domainName,
    employment_type: employmentType,
    experience_level: experienceLevel,
    location: location || null,
    company_slug: companySlug || null,
    skill_slug: skill_slug,
  };

  return {
    filters,
    page,
    limit,
    sort,
    applied_filters_for_response: {
      q: q || undefined,
      domain: domainRaw === 'all' || !domainRaw ? 'all' : domainRaw,
      employment_type: employmentTypeRaw === 'all' || !employmentTypeRaw ? 'all' : (employmentType ?? employmentTypeRaw),
      experience_level: experienceLevelRaw === 'all' || !experienceLevelRaw ? 'all' : (experienceLevel ?? experienceLevelRaw),
      location: location || undefined,
      company_slug: companySlug || undefined,
      skill: skill_slug ?? undefined,
      sort,
    },
  };
}

/**
 * Map domain name to slug for facet response.
 */
function domainNameToSlug(name) {
  const d = JOB_DOMAINS.find((x) => x.name === name);
  return d ? d.slug : name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || '';
}

/**
 * Build facets for API response (domains with slug, employment_types and experience_levels with value + count).
 */
function formatFacets(daoFacets) {
  return {
    domains: (daoFacets.domains || []).map(({ domain, count }) => ({
      slug: domainNameToSlug(domain),
      name: domain,
      count,
    })),
    employment_types: (daoFacets.employment_types || []).map(({ employment_type, count }) => ({
      value: employment_type,
      count,
    })),
    experience_levels: (daoFacets.experience_levels || []).map(({ experience_level, count }) => ({
      value: experience_level,
      count,
    })),
  };
}

/**
 * Get paginated job list with filters, meta, applied_filters, and facets.
 * Each job gets a short description preview via pickRelevantDescriptionSections (same as domain job cards).
 */
export async function getJobList(params) {
  const { filters, page, limit, sort, applied_filters_for_response } = params;
  const [rawJobs, total, facets] = await Promise.all([
    jobsDao.searchJobs({ filters, page, limit, sort }),
    jobsDao.countJobs({ filters }),
    jobsDao.getJobFacets({ filters }),
  ]);

  const jobs = await Promise.all(
    rawJobs.map(async (job) => {
      let descriptionPreview = null;
      try {
        const desc =
          typeof job.description === 'string' ? JSON.parse(job.description) : job.description;
        descriptionPreview = await pickRelevantDescriptionSections(desc);
      } catch {
        descriptionPreview = null;
      }
      const { description: _raw, ...rest } = job;
      return {
        ...rest,
        description: descriptionPreview,
      };
    })
  );

  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  const meta = {
    page,
    limit,
    total,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };

  const payload = {
    jobs,
    meta,
    applied_filters: applied_filters_for_response,
    facets: formatFacets(facets),
  };

  if (filters.skill_slug) {
    const skillInfo = getSkillBySlug(filters.skill_slug);
    payload.skill = skillInfo ? { name: skillInfo.name, slug: skillInfo.slug } : { name: null, slug: filters.skill_slug };
  }

  return payload;
}

/**
 * Get filter options (facets) for initial /jobs page load. Uses no filters so counts are global.
 */
export async function getJobFilters() {
  const filters = {
    q: null,
    domain: null,
    employment_type: null,
    experience_level: null,
    location: null,
    company_slug: null,
  };
  const facets = await jobsDao.getJobFacets({ filters });
  return { facets: formatFacets(facets) };
}
