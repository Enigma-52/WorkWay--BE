import PostgresDao from './dao.js';

const INSERT_EVENT_SQL = `
  INSERT INTO job_view_events (
    job_id,
    job_slug,
    job_title,
    company,
    viewer_country,
    viewer_city,
    source_page,
    user_agent
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING
    id,
    job_id,
    job_slug,
    job_title,
    company,
    viewer_country,
    viewer_city,
    source_page,
    created_at
`;

const LIST_RECENT_SQL = `
  SELECT
    id,
    job_id,
    job_slug,
    job_title,
    company,
    viewer_country,
    viewer_city,
    source_page,
    created_at
  FROM job_view_events
  ORDER BY created_at DESC
  LIMIT $1
`;

class JobViewEventsDao extends PostgresDao {
  constructor() {
    super('job_view_events');
  }

  async insertEvent({
    jobId,
    jobSlug,
    jobTitle,
    company,
    viewerCountry,
    viewerCity,
    sourcePage,
    userAgent,
  }) {
    const rows = await this.getQ({
      sql: INSERT_EVENT_SQL,
      values: [
        jobId,
        jobSlug,
        jobTitle,
        company,
        viewerCountry ?? 'Unknown',
        viewerCity ?? null,
        sourcePage ?? 'job',
        userAgent ?? null,
      ],
    });
    return rows[0];
  }

  async listRecent({ limit }) {
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
    return this.getQ({
      sql: LIST_RECENT_SQL,
      values: [safeLimit],
    });
  }
}

export const jobViewEventsDao = new JobViewEventsDao();

