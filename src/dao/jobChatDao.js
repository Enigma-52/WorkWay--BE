import PostgresDao from './dao.js';

const MAX_HISTORY_LIMIT = 30;

export const jobChatQ = {
  CREATE_SESSION: `
    INSERT INTO job_chat_sessions (
      job_id,
      job_slug,
      job_title,
      company,
      user_agent,
      ip_address,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING id, created_at
  `,
  GET_SESSION: `
    SELECT id, job_id, job_slug, job_title, company, created_at
    FROM job_chat_sessions
    WHERE id = $1
    LIMIT 1
  `,
  GET_RECENT_MESSAGES: `
    SELECT role, content, created_at
    FROM job_chat_messages
    WHERE session_id = $1
    ORDER BY id DESC
    LIMIT $2
  `,
  INSERT_MESSAGE: `
    INSERT INTO job_chat_messages (
      session_id,
      role,
      content,
      model_name,
      prompt_tokens,
      completion_tokens,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING id, created_at
  `,
};

class JobChatDao extends PostgresDao {
  constructor() {
    super('job_chat_sessions');
  }

  async createSession({
    jobId,
    jobSlug,
    jobTitle,
    company,
    userAgent = null,
    ipAddress = null,
    metadata = {},
  }) {
    return this.getQ({
      sql: jobChatQ.CREATE_SESSION,
      values: [
        jobId,
        jobSlug,
        jobTitle,
        company,
        userAgent,
        ipAddress,
        JSON.stringify(metadata || {}),
      ],
      firstResultOnly: true,
    });
  }

  async getSession(sessionId) {
    return this.getQ({
      sql: jobChatQ.GET_SESSION,
      values: [sessionId],
      firstResultOnly: true,
    });
  }

  async getRecentMessages({ sessionId, limit = 12 }) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 12, MAX_HISTORY_LIMIT));
    const rows = await this.getQ({
      sql: jobChatQ.GET_RECENT_MESSAGES,
      values: [sessionId, safeLimit],
    });
    return rows.reverse();
  }

  async insertMessage({
    sessionId,
    role,
    content,
    modelName = null,
    promptTokens = null,
    completionTokens = null,
    metadata = {},
  }) {
    return this.getQ({
      sql: jobChatQ.INSERT_MESSAGE,
      values: [
        sessionId,
        role,
        content,
        modelName,
        promptTokens,
        completionTokens,
        JSON.stringify(metadata || {}),
      ],
      firstResultOnly: true,
    });
  }
}

export const jobChatDao = new JobChatDao();
