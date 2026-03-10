-- Required for pgcrypto if you later add UUID columns (optional)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS job_chat_sessions (
  id                BIGSERIAL PRIMARY KEY,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  job_id            BIGINT REFERENCES jobs(id) ON DELETE SET NULL,
  job_slug          VARCHAR(255) NOT NULL,
  job_title         VARCHAR(255),
  company           VARCHAR(255),

  user_agent        TEXT,
  ip_address        INET,
  metadata          JSONB
);

CREATE INDEX IF NOT EXISTS idx_job_chat_sessions_job_slug
  ON job_chat_sessions (job_slug);

CREATE INDEX IF NOT EXISTS idx_job_chat_sessions_created_at
  ON job_chat_sessions (created_at DESC);

CREATE TABLE IF NOT EXISTS job_chat_messages (
  id                BIGSERIAL PRIMARY KEY,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  session_id        BIGINT NOT NULL REFERENCES job_chat_sessions(id) ON DELETE CASCADE,
  role              VARCHAR(32) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content           TEXT NOT NULL,

  model_name        VARCHAR(128),
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  metadata          JSONB
);

CREATE INDEX IF NOT EXISTS idx_job_chat_messages_session_id_id
  ON job_chat_messages (session_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_job_chat_messages_created_at
  ON job_chat_messages (created_at DESC);
