import { defaultPgDao, runPgStatement } from '../dao/dao.js';
import { buildJobEmbeddingText } from '../utils/helper.js';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL,
    'X-Title': process.env.OPENROUTER_SITE_NAME,
  },
});

// ---- tunables (safe defaults) ----
const CONCURRENCY = 5; // adjust based on OpenRouter limits + DB capacity

const SYSTEM_MESSAGE = {
  role: 'system',
  content:
    'You are a data enrichment service. Output strictly valid JSON. No markdown. No commentary.',
};

function buildPrompt(companyName) {
  return `
Find the official website and a concise 2-line description for "${companyName}".
Always assume that the name mentioned is the company name and there is a company with that name.

Return ONLY valid JSON in this exact format:
{
  "url": "https://example.com",
  "description": "..."
}
`.trim();
}

function parseAIResponse(raw) {
  if (!raw) throw new Error('Empty AI response');
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function enrichSingleCompany(company) {
  try {
    console.log(`Generating company description for ${company.name}`);
    const completion = await client.chat.completions.create({
      model: 'openai/gpt-5-nano',
      messages: [
        SYSTEM_MESSAGE,
        { role: 'user', content: buildPrompt(company.name) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    const aiData = parseAIResponse(raw);

    const url = aiData.url || `${company.name}.com`;
    const description = aiData.description || 'No description found.';

    await runPgStatement({
      query: `
        UPDATE companies
        SET website = $1, description = $2
        WHERE id = $3
      `,
      values: [url, description, company.id],
    });

    console.log(`Generated company description for ${company.name}`);

    return {
      id: company.id,
      name: company.name,
      url,
      description,
    };
  } catch (error) {
    console.error(`AI Enrichment failed for ${company.name}:`, error.message);

    return {
      id: company.id,
      name: company.name,
      url: `${company.name}.com`,
      description: 'No description available',
    };
  }
}

// Simple concurrency pool (no dependency, predictable behavior)
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  }

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    runner
  );

  await Promise.all(runners);
  return results;
}

export async function generateCompanyDesc() {
  // 1. Fetch companies missing descriptions
  const companies = await defaultPgDao.getAllRows({
    tableName: 'companies',
    where: "description = 'No description available'",
  });

  if (companies.length === 0) return [];

  // 2. Parallel enrichment with bounded concurrency
  return runWithConcurrency(companies, CONCURRENCY, enrichSingleCompany);
}

export async function generateEmbeddings(type) {
    if(type === 'jobs')
    {
        await generateJobEmbeddings();
        return;
    }
    // else if(type === 'company')
    // {
    //     await generateCompanyEmbeddings();
    //     return;
    // }
    // else
    // {
    //     throw new Error('Invalid type');
    // }
}

const FETCH_LIMIT = 100;   // how many rows to fetch per DB call
const BATCH_SIZE = 20;     // how many embeddings to run in parallel

export async function generateEmbedding(text) {
    const completion = await client.embeddings.create({
        model: 'openai/text-embedding-3-small',
        input: text,
    });
    return completion.data[0].embedding;
}

export async function generateJobEmbeddings() {
    while (true) {
        const jobs = await defaultPgDao.getAllRows({
            tableName: 'jobs',
            where: "embedding IS NULL",
            limit: FETCH_LIMIT,
            orderBy: 'id DESC',
        });

        if (jobs.length === 0) return;

        // split into batches
        for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
            const batch = jobs.slice(i, i + BATCH_SIZE);

            await Promise.all(
                batch.map(async (job) => {
                    const embeddingText = await buildJobEmbeddingText(job);
                    const embedding = await generateEmbedding(embeddingText);
                    const vectorLiteral = `[${embedding.join(',')}]`;

                    await runPgStatement({
                        query: `UPDATE jobs SET embedding = $1::vector WHERE id = $2`,
                        values: [vectorLiteral, job.id],
                    });
                })
            );

            console.log(`Processed batch of ${batch.length}`);
        }
    }
}

export async function searchJobsByQuery(queryText) {
    // 1. generate embedding for query
    const embedding = await generateEmbedding(queryText);
    const vectorLiteral = `[${embedding.join(',')}]`;

    // 2. similarity search (cosine distance)
    const result = await runPgStatement({
        query: `
            SELECT 
                title,
                company,
                1 - (embedding <=> $1::vector) AS similarity
            FROM jobs
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT 5
        `,
        values: [vectorLiteral],
    });

    // 3. return formatted results
    return result.map(r => ({
        title: r.title,
        company: r.company,
        similarity: Number(r.similarity),
    }));
}