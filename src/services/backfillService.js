import { runPgStatement } from "../dao/dao.js";
import { matchSkillsInText } from "../data/skills.js";

const BATCH_SIZE = 100;
const CONCURRENCY = 100; // number of parallel DB updates

/**
 * Get jobs with empty skills but existing description
 */
async function getJobsWithEmptySkills(limit, offset) {
  return runPgStatement({
    query: `
      SELECT id, description
      FROM jobs
      WHERE platform = 'lever'
        AND description IS NOT NULL
      ORDER BY id
      LIMIT ${limit}
      OFFSET ${offset}
    `,
  });
}

/**
 * Update job skills
 */
async function updateJobSkills(jobId, skills) {
  return runPgStatement({
    query: `
      UPDATE jobs
      SET skills = $1
      WHERE id = $2
    `,
    values: [JSON.stringify(skills), jobId],
  });
}

/**
 * Convert stored description -> plain text
 * Supports JSON string OR already-parsed object
 */
function extractTextFromDescription(desc) {
  if (!desc) return "";

  let sections;

  if (typeof desc === "string") {
    try {
      sections = JSON.parse(desc);
    } catch {
      return "";
    }
  } else {
    sections = desc;
  }

  if (!Array.isArray(sections)) return "";

  return sections
    .map((s) => [s.heading, ...(s.content || [])].join(" "))
    .join("\n");
}

/**
 * Run promises in chunks (simple concurrency control)
 */
async function runParallel(items, limit, handler) {
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    await Promise.all(chunk.map(handler));
  }
}

/**
 * MAIN
 */
export async function backfillSkillsFromStoredDescriptions() {
  console.log("Starting skills backfill...");

  let offset = 0;
  let totalUpdated = 0;

  while (true) {
    const jobs = await getJobsWithEmptySkills(BATCH_SIZE, offset);
    if (!jobs.length) break;

    console.log(`Processing ${jobs.length} jobs (offset ${offset})`);

    await runParallel(jobs, CONCURRENCY, async (job) => {
      try {
        const text = extractTextFromDescription(job.description);
        if (!text) return;

        const skills = matchSkillsInText(text);
        console.log(skills);
        await updateJobSkills(job.id, skills || []);
        console.log(job.id);
        totalUpdated++;
        console.log("Updated skills for "  , BATCH_SIZE  , " jobs.")
      } catch (err) {
        console.error("Failed job", job.id, err.message);
      }
    });

    offset += BATCH_SIZE;
  }

  console.log("Done. Total updated:", totalUpdated);
}