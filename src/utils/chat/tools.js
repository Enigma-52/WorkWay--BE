import OpenAI from 'openai';
import { defaultPgDao, runPgStatement } from '../../dao/dao.js';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL,
    'X-Title': process.env.OPENROUTER_SITE_NAME,
  },
});


export async function filterJobsStructured(filters) {

    const conditions = [];

    const { location , domain , experience_level } = filters;
  
    if (location) {
      conditions.push(`location ILIKE '${location}'`)
    }
  
    if (domain) {
      conditions.push(`domain = '${domain}'`)
    }
  
    if (experience_level) {
      conditions.push(`experience_level = '${experience_level}'`)
    }
  
    const whereClause = conditions.length
      ? conditions.join(' AND ')
      : undefined
  
    const rows = await defaultPgDao.getAllRowsForChat({
      tableName: 'jobs',
      columns: ['id', 'title', 'company'],   
      where: whereClause,
      limit: 100
    })
  
    return {
      candidate_ids: rows.map(r => r.id),
      preview: rows,       
      count: rows.length
    }
  }


  export async function rankJobsWithinCandidates(queryText, candidateIds) {
    if (!candidateIds.length) return []
  
    const embedding = await generateEmbedding(queryText)
    const vectorLiteral = `[${embedding.join(',')}]`
  
    const result = await runPgStatement({
      query: `
        SELECT
          id,
          title,
          company,
          url,
          location,
          1 - (embedding <=> $1::vector) AS similarity
        FROM jobs
        WHERE id = ANY($2::int[]) AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT 5
      `,
      values: [vectorLiteral, candidateIds]
    })
  
    return result.map(r => ({
      id: r.id,
      title: r.title,
      company: r.company,
      location: r.location,
      similarity: Number(r.similarity),
      url : r.url
    }))
  }


export async function generateEmbedding(text) {
    const completion = await client.embeddings.create({
        model: 'openai/text-embedding-3-small',
        input: text,
    });
    return completion.data[0].embedding;
}

export async function getAllDomains() {
    const result = await runPgStatement({
      query: `SELECT DISTINCT domain FROM jobs WHERE domain IS NOT NULL`,
      values: []
    })
  
    return result
  }
  
  export async function getAllExperienceLevels() {
    const result = await runPgStatement({
      query: `SELECT DISTINCT experience_level FROM jobs WHERE experience_level IS NOT NULL`,
      values: []
    })
  
    return result
  }