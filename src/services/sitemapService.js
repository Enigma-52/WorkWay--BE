import { runPgStatement } from '../dao/dao.js'; // adjust path
import { JOB_DOMAINS } from '../utils/constants.js';

// NOTE: These lists mirror workway-next/src/data/locationSeoData.ts
// Keep in sync when adding new roles or locations.
const SEO_ROLES = [
  "software-engineer", "frontend-engineer", "backend-engineer",
  "full-stack-engineer", "product-manager", "data-scientist",
  "devops-engineer", "machine-learning-engineer", "ui-ux-designer",
  "data-analyst", "ios-engineer", "android-engineer", "qa-engineer",
  "site-reliability-engineer", "engineering-manager", "product-designer",
  "business-analyst", "marketing-manager", "customer-success-manager",
  "technical-writer", "hr-manager", "finance-analyst",
  "operations-manager", "legal-counsel", "sales-engineer",
];

const SEO_LOCATIONS = [
  "bangalore", "remote", "san-francisco", "new-york", "london",
  "hyderabad", "mumbai", "delhi", "seattle", "austin",
  "singapore", "berlin", "toronto", "dubai", "pune",
  "chennai", "boston", "los-angeles", "chicago", "amsterdam",
  "paris", "sydney", "tokyo", "dublin", "bengaluru",
];

const BASE_URL = 'https://www.workway.dev';

function today() {
  return new Date().toISOString().split('T')[0];
}

function urlTag({ loc, lastmod, changefreq, priority }) {
  return `
  <url>
    <loc>${BASE_URL}${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function wrapUrlSet(items) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items.join('')}
</urlset>`;
}

function sitemapTag(path) {
  return `
  <sitemap>
    <loc>${BASE_URL}${path}</loc>
    <lastmod>${today()}</lastmod>
  </sitemap>`;
}

function wrapSitemapIndex(items) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items.join('')}
</sitemapindex>`;
}

/* =========================
   SITEMAP INDEX
========================= */

export function generateSitemapIndex() {
  return wrapSitemapIndex([
    sitemapTag('/sitemaps/static.xml'),
    sitemapTag('/sitemaps/companies.xml'),
    sitemapTag('/sitemaps/domains.xml'),
    sitemapTag('/sitemaps/jobs.xml'),
    sitemapTag('/sitemaps/skills.xml'),
    sitemapTag('/sitemaps/location-seo.xml'),
  ]);
}

/* =========================
   STATIC
========================= */

export function generateStaticSitemap() {
  const d = today();

  const urls = [
    { loc: '/', changefreq: 'daily', priority: 1.0 },
    { loc: '/about', changefreq: 'daily', priority: 0.8 },
    { loc: '/companies', changefreq: 'daily', priority: 0.9 },
    { loc: '/domains', changefreq: 'daily', priority: 0.8 },
    { loc: '/jobs', changefreq: 'daily', priority: 0.8 },
    { loc: '/hireme', changefreq: 'daily', priority: 0.8 },
    { loc: '/skills', changefreq: 'daily', priority: 0.8 },
    { loc: '/changelog', changefreq: 'daily', priority: 0.8 },
    { loc: '/feedback', changefreq: 'daily', priority: 0.8 },
    { loc: '/contact', changefreq: 'daily', priority: 0.8 },
    { loc: '/privacy-policy', changefreq: 'daily', priority: 0.8 },
    { loc: '/terms', changefreq: 'daily', priority: 0.8 },
    { loc: '/disclaimer', changefreq: 'daily', priority: 0.8 },
    { loc: '/location-jobs', changefreq: 'weekly', priority: 0.9 },
  ];

  return wrapUrlSet(
    urls.map((u) =>
      urlTag({
        ...u,
        lastmod: d,
      })
    )
  );
}

/* =========================
   COMPANIES (TEMP STATIC)
========================= */

export async function generateCompaniesSitemap() {
  const d = today();
  const rows = await runPgStatement({
    query: `
      SELECT slug
      FROM companies
      WHERE slug IS NOT NULL
    `,
  });

  const items = rows.map((r) =>
    urlTag({
      loc: `/company/${r.slug}`,
      lastmod: d,
      changefreq: 'daily',
      priority: 0.9,
    })
  );

  return wrapUrlSet(items);
}

/* =========================
   DOMAINS (TEMP STATIC)
========================= */

export async function generateDomainsSitemap() {
  const d = today();
  const items = JOB_DOMAINS.map((dObj) =>
    urlTag({
      loc: `/domain/${dObj.slug}`,
      lastmod: d,
      changefreq: 'daily',
      priority: 0.8,
    })
  );

  return wrapUrlSet(items);
}

/* =========================
   LOCATION SEO PAGES
========================= */

export async function generateLocationSeoSitemap() {
  const d = today();

  const rows = await runPgStatement({
    query: `
      SELECT r.role_slug, l.location_slug
      FROM unnest($1::text[]) AS r(role_slug)
      CROSS JOIN unnest($2::text[]) AS l(location_slug)
      JOIN jobs j
        ON LOWER(j.title)    LIKE '%' || REPLACE(r.role_slug,    '-', ' ') || '%'
       AND LOWER(j.location) LIKE '%' || REPLACE(l.location_slug, '-', ' ') || '%'
      GROUP BY r.role_slug, l.location_slug
      HAVING COUNT(j.id) > 1
    `,
    values: [SEO_ROLES, SEO_LOCATIONS],
  }).catch(() => []);

  // Fallback to all combos if DB is unreachable
  const validCombos = new Set(rows.map((r) => `${r.role_slug}|${r.location_slug}`));
  const source = validCombos.size > 0
    ? SEO_ROLES.flatMap((role) =>
        SEO_LOCATIONS.filter((loc) => validCombos.has(`${role}|${loc}`))
          .map((loc) => ({ role, loc }))
      )
    : SEO_ROLES.flatMap((role) => SEO_LOCATIONS.map((loc) => ({ role, loc })));

  const items = source.map(({ role, loc }) =>
    urlTag({ loc: `/${role}-jobs-in-${loc}`, lastmod: d, changefreq: 'weekly', priority: 0.7 })
  );

  return wrapUrlSet(items);
}

/* =========================
   JOBS (EMPTY FOR NOW)
========================= */

export async function generateJobsSitemap() {
  const rows = await runPgStatement({
    query: `
      SELECT slug, updated_at
      FROM jobs
      WHERE slug IS NOT NULL
    `,
  });

  const items = rows.map((r) =>
    urlTag({
      loc: `/job/${r.slug}`,
      lastmod: today(),
      changefreq: 'daily',
      priority: 0.9,
    })
  );

  return wrapUrlSet(items);
}


export async function generateSkillsSitemap() {
  const rows = await runPgStatement({
    query: `
      SELECT name, slug
      FROM skills
      WHERE slug IS NOT NULL
    `,
  });

  const items = rows.map((r) =>
    urlTag({
      loc: `/skill/${r.slug}`,
      lastmod: today(),
      changefreq: 'daily',
      priority: 0.9,
    })
  );

  return wrapUrlSet(items);

}




const JOBS_PER_SITEMAP = 20000;

/* Jobs sitemap index */
export async function generateJobsSitemapIndex() {

  const rows = await runPgStatement({
    query: `
      SELECT COUNT(*)::int AS count
      FROM jobs
      WHERE slug IS NOT NULL
    `,
  });

  const totalJobs = rows[0].count;
  const pages = Math.ceil(totalJobs / JOBS_PER_SITEMAP);

  const items = [];

  for (let i = 1; i <= pages; i++) {
    items.push(
      sitemapTag(`/sitemaps/jobs-${i}.xml`)
    );
  }

  return wrapSitemapIndex(items);
}


/* Individual sitemap page */
export async function generateJobsSitemapPage(page) {

  const limit = JOBS_PER_SITEMAP;
  const offset = (page - 1) * limit;

  const rows = await runPgStatement({
    query: `
      SELECT slug, updated_at
      FROM jobs
      WHERE slug IS NOT NULL
      ORDER BY id
      LIMIT $1 OFFSET $2
    `,
    values: [limit, offset],
  });

  const items = rows.map((r) =>
    urlTag({
      loc: `/job/${r.slug}`,
      lastmod: today(),
      changefreq: 'weekly',
      priority: 0.9,
    })
  );

  return wrapUrlSet(items);
}