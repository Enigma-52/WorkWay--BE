import express from 'express';
import {
  generateSitemapIndex,
  generateStaticSitemap,
  generateCompaniesSitemap,
  generateDomainsSitemap,
  generateJobsSitemap,
  generateSkillsSitemap,
  generateTalentsSitemap,
  generateLocationSeoSitemap,
  generateLocationOnlySitemap,
} from '../services/sitemapService.js';

const router = express.Router();

// None of these routes previously set any Cache-Control, so every hit —
// including jobs.xml's live 30,000-row query — ran against the DB on every
// single request from every visitor and crawler, with Cloudflare unable to
// serve anything from edge cache. A 1hr cache means Google's (and anyone
// else's) sitemap fetches mostly hit Cloudflare's edge instead of the
// origin/DB, cutting real load and insulating sitemap fetches from any
// transient origin blip — the same class of issue that failed robots.txt's
// live test earlier today.
function setSitemapCacheHeaders(res) {
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
}

/* Sitemap index */
router.get('/sitemap.xml', (req, res) => {
  const xml = generateSitemapIndex();
  setSitemapCacheHeaders(res);
  res.status(200).send(xml);
});

/* Static pages */
router.get('/sitemaps/static.xml', (req, res) => {
  const xml = generateStaticSitemap();
  setSitemapCacheHeaders(res);
  res.status(200).send(xml);
});

/* Companies */
router.get('/sitemaps/companies.xml', async (req, res) => {
  const xml = await generateCompaniesSitemap();
  setSitemapCacheHeaders(res);
  res.status(200).send(xml);
});

/* Domains */
router.get('/sitemaps/domains.xml', async (req, res) => {
  const xml = await generateDomainsSitemap();
  setSitemapCacheHeaders(res);
  res.status(200).send(xml);
});

/* Jobs (most recent 50k) */
router.get('/sitemaps/jobs.xml', async (req, res) => {
  const xml = await generateJobsSitemap();
  setSitemapCacheHeaders(res);
  res.status(200).send(xml);
});

router.get('/sitemaps/skills.xml', async (req, res) => {
  const xml = await generateSkillsSitemap();
  setSitemapCacheHeaders(res);
  res.status(200).send(xml);
});

/* Talent profiles (published only) */
router.get('/sitemaps/talents.xml', async (req, res) => {
  const xml = await generateTalentsSitemap();
  setSitemapCacheHeaders(res);
  res.status(200).send(xml);
});

/* Location SEO pages */
router.get('/sitemaps/location-seo.xml', async (req, res) => {
  const xml = await generateLocationSeoSitemap();
  setSitemapCacheHeaders(res);
  res.status(200).send(xml);
});

/* Location-only SEO pages */
router.get('/sitemaps/location-only.xml', async (req, res) => {
  const xml = await generateLocationOnlySitemap();
  setSitemapCacheHeaders(res);
  res.status(200).send(xml);
});

export default router;
