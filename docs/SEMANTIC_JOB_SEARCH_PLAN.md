# Semantic Job Search + Chat Delivery Plan

This document outlines a plan to add semantic job search and chat-based delivery to WorkWay--BE, from background processing through real-time results. It is aligned to the current backend architecture (routes -> services -> DAO -> PostgreSQL) and keeps code snippets to a minimum.

## 1) Goals and Scope
- Enable semantic search across job listings beyond keyword matching.
- Support conversational queries and follow-ups via a chat interface.
- Provide real-time or near-real-time result updates.
- Preserve current API structure and data ownership in this repo.

Out of scope for this document:
- Frontend UI implementation details.
- Vendor-specific billing/contracting decisions.

## 2) High-Level User Flow
Users have two search modes: Meaning Search and Filter Search.

Meaning Search:
1. User asks a question in chat (e.g., "remote fintech backend roles in Europe").
2. System interprets intent and constraints.
3. Semantic search runs across jobs (vector similarity + filters).
4. Results are streamed back to the chat UI with progressive updates.
5. User refines query; the system reuses context and continues the session.

Filter Search:
1. User sends a free-text request (e.g., "show me senior backend jobs in Berlin").
2. System translates the request into existing filters (location, domain, employment type, experience level).
3. System asks for confirmation or edits (user says yes or tweaks).
4. System executes filter-based search and streams results.

## 3) Feature Components

### 3.1 Data Preparation
- Normalize job content (title, company, location, description sections).
- Create embeddings for searchable fields.
- Store embeddings in a vector index.

### 3.2 Semantic Search Service
- Accepts query + optional filters (location, domain, employment type, experience level).
- Generates query embeddings.
- Queries vector index and returns top N results.
- Ranks + post-filters against structured fields.

### 3.3 Filter Translation Service
- Accepts a free-text request.
- Produces structured filters from existing fields.
- Returns a confirmation payload for user approval.

### 3.4 Chat Orchestration
- Maintains a conversation state (session ID, user preferences, last query).
- Handles follow-ups ("only remote", "show me senior roles").
- Supports tool calls: semantic search, filter translation, filters, and enrichment.

### 3.5 Real-Time Delivery
- Uses server-sent events (SSE) or WebSockets for streaming responses.
- Enables multi-stage response: acknowledgement, reasoning, results, refinements.

## 4) Data and Storage Requirements

### 4.1 New or Extended Tables
- `job_embeddings` (or extension to `jobs`):
  - `job_id`, `embedding`, `embedding_model`, `updated_at`.
- `chat_sessions`:
  - `id`, `context`, `created_at`, `updated_at`.
- `chat_messages`:
  - `id`, `session_id`, `role`, `content`, `created_at`.

### 4.2 Vector Index Options
- PostgreSQL `pgvector` (co-located with existing DB).
- External vector DB (if scale requires separation).

Select based on:
- Size of job corpus.
- Query latency requirements.
- Operational constraints (managed vs self-hosted).

## 5) Background Processing Pipeline

### 5.1 Ingestion Hook
- After job ingestion/upsert, enqueue embedding generation.
- Batch updates to reduce compute cost.

### 5.2 Embedding Worker
- Reads new/changed jobs.
- Computes embeddings for relevant text fields.
- Writes embeddings to vector store.

### 5.3 Scheduling
- Initial full backfill.
- Incremental updates triggered by ingestion.
- Periodic re-embedding when model changes.

## 6) API Surface Changes (Planned)

### 6.1 Semantic Search Endpoint
- `POST /api/search/semantic`
- Request:
  - `query`, optional `filters`, optional `limit`.
- Response:
  - `results` (job summaries), `meta` (latency, model version).

### 6.2 Chat Endpoint
- `POST /api/chat`
- Request:
  - `session_id` (optional), `message`, `mode` (meaning | filter), `context` (optional).
- Response:
  - `session_id`, `messages`, `suggestions`, `pending_filters` (when in filter mode).

### 6.3 Real-Time Stream
- `GET /api/chat/stream?session_id=...`
- Delivers incremental chat updates.

## 7) Ranking and Relevance
- Combine semantic score with structured signals:
  - recency, company activity, domain fit, location match.
- Allow user preference boosts (remote, salary, tech stack).
- Use diversification to avoid near-duplicate results.

## 8) Observability and Quality
- Track search latency, hit rate, and bounce rate.
- Log query patterns and feedback for tuning.
- Offline evaluation with labeled relevance pairs.

## 9) Security and Abuse
- Rate limit chat and search endpoints.
- Filter prompt injection or unsafe requests.
- Avoid leaking sensitive data in chat responses.

## 10) Rollout Plan

### Phase 1: Foundation
- Add embeddings table and vector index.
- Create a background embedding job.
- Implement semantic search endpoint.

### Phase 2: Chat Experience
- Introduce chat session/message storage.
- Implement chat endpoint with search tool calls.
- Provide basic response streaming.

### Phase 3: Real-Time and Tuning
- Improve ranking with feedback loops.
- Add preference learning.
- Add A/B testing and performance optimization.

## 11) Minimal Example (Illustrative Only)

```js
// Pseudocode only: semantic search request shape
{
  "query": "remote data engineer, europe",
  "filters": { "location": "europe", "employment_type": "full_time" },
  "limit": 20
}
```

## 12) Dependencies and Team Needs
- Embedding model provider (hosted or self-hosted).
- Vector search infrastructure.
- Background job runner (could be cron-style endpoints, queue, or worker process).
- Observability stack (metrics + logs).

## 13) Open Questions
- Do we require personalization by user profile?
- Desired latency and result freshness targets?

## 14) Risks
- Embedding drift and model updates.
- High compute cost for full corpus re-embedding.
- Data privacy constraints if using external model providers.
- Real-time streaming complexity in production.
