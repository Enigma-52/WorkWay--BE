import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  const baseUrl = 'https://www.workway.dev';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.status(200).send(xml);
});

export default router;
