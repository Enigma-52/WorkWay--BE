import { jobsDao, DEFAULT_LIMIT, MAX_LIMIT } from '../dao/jobsDao.js';
import { getSkillBySlug } from '../data/skills.js';
import { JOB_DOMAINS, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, JOB_PLATFORMS } from '../utils/constants.js';
import { pickRelevantDescriptionSections } from '../utils/helper.js';
import { isValidCountryCode } from '../utils/countryAliases.js';

// The global (fully unfiltered) total count and facet breakdown only change
// when the ingestion crons run (every few hours), but were being recomputed
// via full-table GROUP BY / COUNT(*) scans on every single unfiltered /jobs
// pageview. Cache them for a short window instead — the job list itself is
// still fetched fresh every time (see getJobList), only these two heavy
// aggregate queries are skipped on a cache hit.
const UNFILTERED_FACETS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let unfilteredFacetsCache = null; // { total, facets, expiresAt }

function isUnfilteredQuery(filters) {
  return (
    !filters.q &&
    !filters.domain &&
    !filters.employment_type &&
    !filters.experience_level &&
    !filters.location &&
    !filters.country &&
    !filters.company_slug &&
    !filters.skill_slug &&
    !filters.posted_since &&
    !filters.platform
  );
}

// Same rationale as unfilteredFacetsCache, for the other high-traffic case:
// the location-only SEO pages (`/jobs-in-<location>`, `/jobs?location=`).
// `location ILIKE '%x%'` matches a large enough share of the 490k-row jobs
// table that Postgres correctly picks a (parallel) seq scan over the trigram
// index — cheap once, but getJobFacets fires 4 of these concurrently per
// request (count + 3 facet GROUP BYs), and repeat hits on the same location
// from crawlers/users were enough to pin a single-vCPU box's one core and
// starve the 5-connection pg pool for every other route. Bounded to a small
// map (cleared wholesale past the cap) since `location` is free text and an
// unbounded cache keyed on it is itself a memory-growth vector.
const LOCATION_FACETS_CACHE_TTL_MS = 10 * 60 * 1000;
const LOCATION_FACETS_CACHE_MAX_ENTRIES = 200;
const locationFacetsCache = new Map(); // normalized location -> { total, facets, expiresAt }

function isLocationOnlyQuery(filters) {
  return (
    typeof filters.location === 'string' &&
    filters.location.trim() !== '' &&
    !filters.q &&
    !filters.domain &&
    !filters.employment_type &&
    !filters.experience_level &&
    !filters.country &&
    !filters.company_slug &&
    !filters.skill_slug &&
    !filters.posted_since &&
    !filters.platform
  );
}

export async function getJobDetails(slug) {
  try {
    const jobDetails = await jobsDao.getSingleJob({ slug });
    const job = jobDetails[0];

    const allSkills = (job.skills || [])
      .filter((s) => typeof s === 'object' && s.slug);
    const fetchSkills = allSkills.slice(0, 3);
    const fetchSlugs = fetchSkills.map((s) => s.slug);
    const fetchNames = fetchSkills.map((s) => s.name);
    const remainingSkills = allSkills.slice(3).map((s) => ({ name: s.name, slug: s.slug }));

    // Run ALL secondary queries in parallel
    const [domainJobs, companyJobs, jobsBySkill, similarLocationJobs] = await Promise.all([
      jobsDao.getDomainJobwithExclusion({ domain: job.domain, excludeSlug: slug }),
      jobsDao.getCompanyJobwithExclusion({ company: job.company, excludeSlug: slug }),
      fetchSlugs.length > 0
        ? jobsDao.getRecentJobsBySkills({ skillSlugs: fetchSlugs, skillNames: fetchNames, excludeSlug: slug })
        : [],
      job.location
        ? jobsDao.getSimilarLocationJobs({ location: job.location, excludeSlug: slug })
        : [],
    ]);

    return {
      ...job,
      similarJobsByDomain: domainJobs,
      otherJobsByCompany: companyJobs,
      jobsBySkill,
      remainingSkills,
      similarLocationJobs,
    };
  } catch (error) {
    console.error(`Failed to fetch details for job with slug ${slug}:`, error);
    throw error;
  }
}

function parseSalaryRange(compensation) {
  if (!compensation) return null;
  // Match patterns like "$150K", "$150,000", "$150k"
  const amounts = compensation.match(/\$[\d,]+(?:\.\d+)?[kK]?/g);
  if (!amounts || amounts.length === 0) return null;

  const parseAmount = (str) => {
    let num = str.replace(/[$,]/g, '');
    if (num.toLowerCase().endsWith('k')) {
      num = parseFloat(num.slice(0, -1)) * 1000;
    } else {
      num = parseFloat(num);
    }
    return isNaN(num) ? null : num;
  };

  const min = parseAmount(amounts[0]);
  const max = amounts.length > 1 ? parseAmount(amounts[1]) : min;
  return min !== null ? { min, max: max || min } : null;
}

export async function getSalaryInsights({ filters = {}, page = 1, limit = 20, sort = 'salary_desc' }) {
  // Stats query is lightweight — only fetches compensation + domain + level
  const [statsRows, paginatedResult] = await Promise.all([
    jobsDao.getSalaryStatsRows(),
    jobsDao.getSalaryInsightsJobs({ filters, page, limit, sort }),
  ]);

  const analyzed = statsRows.map((row) => {
    const comp = row.compensation || '';
    const range = parseSalaryRange(comp);
    return {
      ...row,
      salary_mid: range ? Math.round((range.min + range.max) / 2) : null,
      offers_equity: comp.toLowerCase().includes('equity'),
      offers_bonus: comp.toLowerCase().includes('bonus'),
    };
  });

  const withSalary = analyzed.filter((j) => j.salary_mid !== null);
  const equityCount = analyzed.filter((j) => j.offers_equity).length;
  const bonusCount = analyzed.filter((j) => j.offers_bonus).length;

  const buckets = { '<$100K': 0, '$100K–150K': 0, '$150K–200K': 0, '$200K–250K': 0, '$250K–300K': 0, '$300K–400K': 0, '$400K–500K': 0, '$500K+': 0 };
  for (const j of withSalary) {
    const mid = j.salary_mid;
    if (mid < 100000) buckets['<$100K']++;
    else if (mid < 150000) buckets['$100K–150K']++;
    else if (mid < 200000) buckets['$150K–200K']++;
    else if (mid < 250000) buckets['$200K–250K']++;
    else if (mid < 300000) buckets['$250K–300K']++;
    else if (mid < 400000) buckets['$300K–400K']++;
    else if (mid < 500000) buckets['$400K–500K']++;
    else buckets['$500K+']++;
  }

  const byDomain = {};
  for (const j of withSalary) {
    if (!j.domain) continue;
    if (!byDomain[j.domain]) byDomain[j.domain] = { count: 0, total: 0 };
    byDomain[j.domain].count++;
    byDomain[j.domain].total += j.salary_mid;
  }
  const domainAvg = Object.entries(byDomain)
    .map(([domain, d]) => ({ domain, avg_salary: Math.round(d.total / d.count), count: d.count }))
    .sort((a, b) => b.avg_salary - a.avg_salary);

  const byLevel = {};
  for (const j of withSalary) {
    if (!j.experience_level) continue;
    if (!byLevel[j.experience_level]) byLevel[j.experience_level] = { count: 0, total: 0 };
    byLevel[j.experience_level].count++;
    byLevel[j.experience_level].total += j.salary_mid;
  }
  const levelAvg = Object.entries(byLevel)
    .map(([level, d]) => ({ level, avg_salary: Math.round(d.total / d.count), count: d.count }))
    .sort((a, b) => b.avg_salary - a.avg_salary);

  const avgSalary = withSalary.length > 0
    ? Math.round(withSalary.reduce((s, j) => s + j.salary_mid, 0) / withSalary.length)
    : 0;
  const medianSalary = withSalary.length > 0
    ? (() => {
        const sorted = withSalary.map((j) => j.salary_mid).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
      })()
    : 0;

  // Enrich paginated jobs with parsed salary
  const jobs = paginatedResult.jobs.map((job) => {
    const comp = job.compensation || '';
    const range = parseSalaryRange(comp);
    return {
      ...job,
      salary_min: range?.min || null,
      salary_max: range?.max || null,
      salary_mid: range ? Math.round((range.min + range.max) / 2) : null,
      offers_equity: comp.toLowerCase().includes('equity'),
      offers_bonus: comp.toLowerCase().includes('bonus'),
    };
  });

  return {
    stats: {
      total_jobs: analyzed.length,
      jobs_with_salary: withSalary.length,
      equity_count: equityCount,
      bonus_count: bonusCount,
      avg_salary: avgSalary,
      median_salary: medianSalary,
    },
    salary_buckets: buckets,
    by_domain: domainAvg,
    by_experience_level: levelAvg,
    jobs,
    meta: {
      page: paginatedResult.page,
      limit: paginatedResult.limit,
      total: paginatedResult.total,
      total_pages: Math.ceil(paginatedResult.total / paginatedResult.limit),
      has_next: paginatedResult.page * paginatedResult.limit < paginatedResult.total,
      has_prev: paginatedResult.page > 1,
    },
  };
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

  const skillSlugRaw =
    typeof (query.skill ?? query.skill_slug) === 'string'
      ? String(query.skill ?? query.skill_slug)
          .trim()
          .toLowerCase()
      : '';
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

  const employmentTypeRaw =
    typeof query.employment_type === 'string' ? query.employment_type.trim() : 'all';
  let employmentType = null;
  if (employmentTypeRaw && employmentTypeRaw !== 'all') {
    const matched = EMPLOYMENT_TYPES.find(
      (v) => v.toLowerCase() === employmentTypeRaw.toLowerCase()
    );
    if (!matched) {
      return {
        error: true,
        status: 400,
        message: `Invalid employment_type: ${query.employment_type}. Allowed: ${EMPLOYMENT_TYPES.join(', ')}, or 'all'.`,
      };
    }
    employmentType = matched;
  }

  const experienceLevelRaw =
    typeof query.experience_level === 'string' ? query.experience_level.trim() : 'all';
  let experienceLevel = null;
  if (experienceLevelRaw && experienceLevelRaw !== 'all') {
    const matched = EXPERIENCE_LEVELS.find(
      (v) => v.toLowerCase() === experienceLevelRaw.toLowerCase()
    );
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

  const platformRaw = typeof query.platform === 'string' ? query.platform.trim().toLowerCase() : 'all';
  let platform = null;
  if (platformRaw && platformRaw !== 'all') {
    if (!JOB_PLATFORMS.includes(platformRaw)) {
      return {
        error: true,
        status: 400,
        message: `Invalid platform: ${query.platform}. Allowed: ${JOB_PLATFORMS.join(', ')}, or 'all'.`,
      };
    }
    platform = platformRaw;
  }

  const countryRaw = typeof query.country === 'string' ? query.country.trim().toUpperCase() : '';
  let country = null;
  if (countryRaw && countryRaw !== 'ALL') {
    if (!isValidCountryCode(countryRaw)) {
      return {
        error: true,
        status: 400,
        message: `Invalid country: ${query.country}. Use a valid ISO alpha-3 code or 'all'.`,
      };
    }
    country = countryRaw;
  }

  const POSTED_MAP = { today: 1, '3d': 3, '7d': 7, '30d': 30 };
  const postedRaw = typeof query.posted === 'string' ? query.posted.trim().toLowerCase() : '';
  let postedSince = null;
  if (postedRaw && postedRaw !== 'all' && POSTED_MAP[postedRaw]) {
    const d = new Date();
    d.setDate(d.getDate() - POSTED_MAP[postedRaw]);
    d.setHours(0, 0, 0, 0);
    postedSince = d.toISOString();
  }

  const filters = {
    q: q || null,
    domain: domainName,
    employment_type: employmentType,
    experience_level: experienceLevel,
    location: location || null,
    country,
    company_slug: companySlug || null,
    skill_slug: skill_slug,
    posted_since: postedSince,
    platform,
  };

  return {
    filters,
    page,
    limit,
    sort,
    applied_filters_for_response: {
      q: q || undefined,
      domain: domainRaw === 'all' || !domainRaw ? 'all' : domainRaw,
      employment_type:
        employmentTypeRaw === 'all' || !employmentTypeRaw
          ? 'all'
          : (employmentType ?? employmentTypeRaw),
      experience_level:
        experienceLevelRaw === 'all' || !experienceLevelRaw
          ? 'all'
          : (experienceLevel ?? experienceLevelRaw),
      location: location || undefined,
      country: country || 'all',
      company_slug: companySlug || undefined,
      skill: skill_slug ?? undefined,
      posted: postedRaw && postedRaw !== 'all' ? postedRaw : undefined,
      platform: platform ?? 'all',
      sort,
    },
  };
}

/**
 * Map domain name to slug for facet response.
 */
function domainNameToSlug(name) {
  const d = JOB_DOMAINS.find((x) => x.name === name);
  return d
    ? d.slug
    : name
        ?.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') || '';
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

  const useCache =
    isUnfilteredQuery(filters) &&
    unfilteredFacetsCache &&
    unfilteredFacetsCache.expiresAt > Date.now();

  const locationCacheKey = isLocationOnlyQuery(filters) ? filters.location.trim().toLowerCase() : null;
  const cachedLocation = locationCacheKey ? locationFacetsCache.get(locationCacheKey) : null;
  const useLocationCache = cachedLocation && cachedLocation.expiresAt > Date.now();

  let rawJobs, total, facets;
  if (useCache) {
    [rawJobs] = await Promise.all([jobsDao.searchJobs({ filters, page, limit, sort })]);
    total = unfilteredFacetsCache.total;
    facets = unfilteredFacetsCache.facets;
  } else if (useLocationCache) {
    [rawJobs] = await Promise.all([jobsDao.searchJobs({ filters, page, limit, sort })]);
    total = cachedLocation.total;
    facets = cachedLocation.facets;
  } else {
    [rawJobs, total, facets] = await Promise.all([
      jobsDao.searchJobs({ filters, page, limit, sort }),
      jobsDao.countJobs({ filters }),
      jobsDao.getJobFacets({ filters }),
    ]);
    if (isUnfilteredQuery(filters)) {
      unfilteredFacetsCache = { total, facets, expiresAt: Date.now() + UNFILTERED_FACETS_CACHE_TTL_MS };
    } else if (locationCacheKey) {
      if (locationFacetsCache.size >= LOCATION_FACETS_CACHE_MAX_ENTRIES) locationFacetsCache.clear();
      locationFacetsCache.set(locationCacheKey, { total, facets, expiresAt: Date.now() + LOCATION_FACETS_CACHE_TTL_MS });
    }
  }

  const jobs = rawJobs.map((job) => {
    let descriptionPreview = null;
    try {
      const desc =
        typeof job.description === 'string' ? JSON.parse(job.description) : job.description;
      descriptionPreview = pickRelevantDescriptionSections(desc);
    } catch {
      descriptionPreview = null;
    }
    const { description: _raw, ...rest } = job;
    return {
      ...rest,
      description: descriptionPreview,
    };
  });

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
    payload.skill = skillInfo
      ? { name: skillInfo.name, slug: skillInfo.slug }
      : { name: null, slug: filters.skill_slug };
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
