import axios from "axios";
import sharp from "sharp";
import pLimit from "p-limit";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { R2Client } from "../utils/r2Client.js";
import { runPgStatement } from "../dao/dao.js";
import { companyDao } from "../dao/companyDao.js";

const BUCKET = "workway-static";
const CDN_BASE = "https://cdn.workway.dev";

export async function uploadLogosToR2() {
  const limit = pLimit(200);

  // 1. Fetch companies
  const rows = await runPgStatement({
    query: `
      SELECT id, namespace, logo_url
      FROM companies
      WHERE logo_url IS NOT NULL
        AND logo_url NOT LIKE '%cdn.workway.dev%'
        ORDER BY created_at asc
        LIMIT 1000
    `
  });

  console.log(`Processing ${rows.length} companies`);

  let success = 0;
  let failed = 0;

  await Promise.all(
    rows.map((company) =>
      limit(async () => {
        const { id, namespace ,logo_url } = company;

        if (!namespace || !logo_url) return;

        try {
          // 2. Fetch existing logo
          const res = await axios.get(logo_url, {
            responseType: "arraybuffer",
            timeout: 10000,
          });

          // 3. Convert → WebP
          const buffer = await sharp(res.data)
            .resize(128, 128, { fit: "inside" })
            .webp({ quality: 80 })
            .toBuffer();

          // 4. Upload to R2
          const key = `logos/${namespace}.webp`;

          await R2Client.send(
            new PutObjectCommand({
              Bucket: BUCKET,
              Key: key,
              Body: buffer,
              ContentType: "image/webp",
              CacheControl: "public, max-age=31536000, immutable",
            })
          );

          // 5. Update DB
          const newUrl = `${CDN_BASE}/${key}`;

          const result = await runPgStatement(
            {query : `UPDATE companies SET logo_url = $1 WHERE id = $2`,
            values : [newUrl, id]
            }
          );

          success++;
          console.log(`✓ ${namespace}`);
        } catch (err) {
          failed++;
          console.error(`✗ ${namespace}`, err.message);
        }
      })
    )
  );

  console.log(`Done. Success: ${success}, Failed: ${failed}`);

  return { success, failed };
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function getCompanyEmbeddingGroups() {
  const companies = await companyDao.getAllCompanyEmbeddings();

  if (!companies || companies.length === 0) {
    return { total: 0, groups: [], message: 'No companies with embeddings found' };
  }

  // Parse embeddings (stored as JSON string or array)
  const parsed = companies.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    embedding: typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding,
  }));

  const selectedCompanies = parsed.slice(0, 5);

  const groups = selectedCompanies.map((company) => {
    const similarities = [];
    for (const other of parsed) {
      if (other.id === company.id) continue;
      const score = cosineSimilarity(company.embedding, other.embedding);
      similarities.push({ id: other.id, name: other.name, slug: other.slug, score });
    }
    similarities.sort((a, b) => b.score - a.score);
    const top10 = similarities.slice(0, 10);

    return {
      company: { id: company.id, name: company.name, slug: company.slug },
      similar: top10,
    };
  });

  return { total: selectedCompanies.length, groups };
}