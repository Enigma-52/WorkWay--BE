import OpenAI from 'openai';
import { isIP } from 'node:net';
import { jobsDao } from '../dao/jobsDao.js';
import { jobChatDao } from '../dao/jobChatDao.js';

const MODEL_NAME = 'openai/gpt-5-nano';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL,
    'X-Title': process.env.OPENROUTER_SITE_NAME,
  },
});

function normalizeOptionalText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeIpAddress(req) {
  const forwarded = req.headers['x-forwarded-for'];
  let candidate = '';

  if (typeof forwarded === 'string') {
    candidate = forwarded.split(',')[0].trim();
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    candidate = String(forwarded[0]).split(',')[0].trim();
  } else if (typeof req.ip === 'string') {
    candidate = req.ip.trim();
  }

  if (candidate.startsWith('::ffff:')) candidate = candidate.slice(7);
  return isIP(candidate) ? candidate : null;
}

function descriptionToText(description) {
  if (!description) return '';

  let parsed = description;
  if (typeof description === 'string') {
    try {
      parsed = JSON.parse(description);
    } catch {
      return description;
    }
  }

  if (!Array.isArray(parsed)) {
    return typeof parsed === 'string' ? parsed : '';
  }

  const sections = parsed
    .map((section) => {
      const heading = normalizeOptionalText(section?.heading) || 'Section';
      const content = Array.isArray(section?.content)
        ? section.content
            .map((line) => normalizeOptionalText(line))
            .filter(Boolean)
            .join('\n')
        : '';
      return `${heading}\n${content}`.trim();
    })
    .filter(Boolean);

  return sections.join('\n\n');
}

function buildSystemPrompt(job) {
  const jobContext = [
    `Title: ${job.title || 'N/A'}`,
    `Company: ${job.company || 'N/A'}`,
    `Location: ${job.location || 'N/A'}`,
    `Employment Type: ${job.employment_type || 'N/A'}`,
    `Experience Level: ${job.experience_level || 'N/A'}`,
    `Domain: ${job.domain || 'N/A'}`,
    `Apply URL: ${job.url || 'N/A'}`,
    '',
    'Job Description:',
    descriptionToText(job.description) || 'No description available.',
  ].join('\n');

  return `
You are WorkWay Job Copilot.
You answer questions only for the current job and its description.
If a detail is missing in the provided context, say it is not listed.
Do not invent compensation, visa, remote policy, interview process, or benefits.
Keep answers concise, practical, and skimmable using bullets when helpful.

CURRENT JOB CONTEXT
${jobContext}
`.trim();
}

function toAssistantText(completion) {
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part?.text === 'string') return part.text;
        if (typeof part === 'string') return part;
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

export async function sendJobChatMessage({
  req,
  jobSlug,
  userMessage,
  sessionId,
}) {
  const slug = normalizeOptionalText(jobSlug);
  const message = normalizeOptionalText(userMessage);

  if (!slug) {
    const err = new Error('job_slug is required');
    err.statusCode = 400;
    throw err;
  }

  if (!message) {
    const err = new Error('message is required');
    err.statusCode = 400;
    throw err;
  }

  const jobs = await jobsDao.getSingleJob({ slug });
  const job = Array.isArray(jobs) && jobs.length > 0 ? jobs[0] : null;
  if (!job) {
    const err = new Error('Job not found for provided slug');
    err.statusCode = 404;
    throw err;
  }

  let activeSessionId = Number.isInteger(Number(sessionId)) ? Number(sessionId) : null;
  let session = null;

  if (activeSessionId) {
    session = await jobChatDao.getSession(activeSessionId);
    if (!session || session.job_slug !== slug) {
      activeSessionId = null;
      session = null;
    }
  }

  if (!activeSessionId) {
    const created = await jobChatDao.createSession({
      jobId: job.id,
      jobSlug: slug,
      jobTitle: job.title || null,
      company: job.company || null,
      userAgent: normalizeOptionalText(req.headers['user-agent']),
      ipAddress: normalizeIpAddress(req),
      metadata: { source: 'job-page-overlay' },
    });
    activeSessionId = created.id;
    session = created;
  }

  await jobChatDao.insertMessage({
    sessionId: activeSessionId,
    role: 'user',
    content: message,
    metadata: { source: 'job-page-overlay' },
  });

  const historyRows = await jobChatDao.getRecentMessages({
    sessionId: activeSessionId,
    limit: 14,
  });

  const messages = [
    { role: 'system', content: buildSystemPrompt(job) },
    ...historyRows
      .filter((row) => row.role === 'user' || row.role === 'assistant')
      .map((row) => ({ role: row.role, content: row.content })),
  ];

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: MODEL_NAME,
      messages,
      temperature: 0.3,
      max_tokens: 700,
      extra_body: {
        reasoning: { effort: 'low' },
      },
    });
  } catch {
    completion = await client.chat.completions.create({
      model: MODEL_NAME,
      messages,
      temperature: 0.3,
      max_tokens: 700,
    });
  }

  const assistantMessage =
    toAssistantText(completion) ||
    'I could not generate a useful response from this job description. Please try again.';

  await jobChatDao.insertMessage({
    sessionId: activeSessionId,
    role: 'assistant',
    content: assistantMessage,
    modelName: MODEL_NAME,
    promptTokens: completion?.usage?.prompt_tokens ?? null,
    completionTokens: completion?.usage?.completion_tokens ?? null,
    metadata: {
      finish_reason: completion?.choices?.[0]?.finish_reason ?? null,
    },
  });

  return {
    session_id: activeSessionId,
    assistant_message: assistantMessage,
    model: MODEL_NAME,
    created_at: new Date().toISOString(),
  };
}
