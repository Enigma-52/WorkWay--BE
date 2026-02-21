import { defaultPgDao, runPgStatement } from '../dao/dao.js';
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
    limit: 100, // unchanged
  });

  if (companies.length === 0) return [];

  // 2. Parallel enrichment with bounded concurrency
  return runWithConcurrency(companies, CONCURRENCY, enrichSingleCompany);
}