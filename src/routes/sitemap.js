import express from 'express';
import {
  generateSitemapIndex,
  generateStaticSitemap,
  generateCompaniesSitemap,
  generateDomainsSitemap,
  generateJobsSitemap,
  generateSkillsSitemap,
  generateJobsSitemapIndex,
  generateJobsSitemapPage,
  generateLocationSeoSitemap,
} from '../services/sitemapService.js';

const router = express.Router();

/* Sitemap index */
router.get('/sitemap.xml', (req, res) => {
  const xml = generateSitemapIndex();
  res.setHeader('Content-Type', 'application/xml');
  res.status(200).send(xml);
});

/* Static pages */
router.get('/sitemaps/static.xml', (req, res) => {
  const xml = generateStaticSitemap();
  res.setHeader('Content-Type', 'application/xml');
  res.status(200).send(xml);
});

/* Companies */
router.get('/sitemaps/companies.xml', async (req, res) => {
  const xml = await generateCompaniesSitemap();
  res.setHeader('Content-Type', 'application/xml');
  res.status(200).send(xml);
});

/* Domains */
router.get('/sitemaps/domains.xml', async (req, res) => {
  const xml = await generateDomainsSitemap();
  res.setHeader('Content-Type', 'application/xml');
  res.status(200).send(xml);
});

/* Jobs Sitemap Index*/
router.get('/sitemaps/jobs.xml', async (req, res) => {
  const xml = await generateJobsSitemapIndex();
  res.setHeader('Content-Type', 'application/xml');
  res.status(200).send(xml);
});

/* Individual job sitemap pages */
router.get('/sitemaps/jobs-:page.xml', async (req, res) => {
  const page = parseInt(req.params.page, 10);

  if (!page || page < 1) {
    return res.status(400).send('Invalid sitemap page');
  }

  const xml = await generateJobsSitemapPage(page);

  res.setHeader('Content-Type', 'application/xml');
  res.status(200).send(xml);
});
router.get('/sitemaps/skills.xml', async (req, res) => {
  const xml = await generateSkillsSitemap();
  res.setHeader('Content-Type', 'application/xml');
  res.status(200).send(xml);
});

/* Location SEO pages */
router.get('/sitemaps/location-seo.xml', async (req, res) => {
  const xml = await generateLocationSeoSitemap();
  res.setHeader('Content-Type', 'application/xml');
  res.status(200).send(xml);
});

export default router;
