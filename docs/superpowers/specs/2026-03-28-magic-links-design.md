# Magic Links Auth — Design Spec
_Date: 2026-03-28_

## Overview

Add magic link (passwordless email) authentication alongside the existing Google OAuth flow. Users enter their email, receive a one-time link, click it to verify, and get a session cookie — consistent with the existing passport session approach.

## Architecture

### New Files
- `src/dao/magicLinksDao.js` — DB operations for `magic_links` table
- `src/services/magicLinkService.js` — token generation, email sending via Resend, verification logic

### Modified Files
- `src/routes/auth.js` — two new routes added
- `package.json` — add `resend` npm package

## Endpoints

### `POST /api/auth/magic-link/send`
- **Body:** `{ email: string }`
- **Logic:**
  1. Validate email present
  2. Generate 32-byte random token via `crypto.randomBytes(32).toString('hex')`
  3. Hash token with SHA-256 (`crypto.createHash('sha256')`)
  4. Insert row into `magic_links`: email, token_hash, expires_at (now + 15 min), ip_address, user_agent
  5. Send email via Resend SDK from `noreply@workway.dev` containing link: `${FRONTEND_URL}/auth/verify?token=<raw_token>`
  6. Return `{ success: true, message: "Magic link sent" }`
- **Error cases:** missing email → 400; Resend failure → 500

### `GET /api/auth/magic-link/verify`
- **Query param:** `token=<raw_hex_token>`
- **Logic:**
  1. Hash the incoming token with SHA-256
  2. Look up row in `magic_links` by `token_hash`
  3. Validate: row exists, `used_at IS NULL`, `expires_at > now()`
  4. Mark `used_at = now()` on the row
  5. Upsert user via existing `usersDao.upsertUser()` with `email_verified = true`
  6. Call `req.login(user, ...)` to establish passport session
  7. Return `{ success: true, user }`
- **Error cases:** invalid/expired/used token → 400 with descriptive message

## Data Layer (`magic_links` table — pre-existing schema)

```sql
CREATE TABLE magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);
```

## Token Security

- Raw token (32 bytes = 64 hex chars) is sent in email only, never stored
- Only SHA-256 hash is stored in DB — prevents DB compromise from leaking usable tokens
- 15-minute TTL on all tokens
- Single-use enforced via `used_at` column

## Email

- Provider: Resend (`resend` npm package)
- API key: `process.env.RESEND_API_KEY`
- From: `noreply@workway.dev`
- Link target: `${process.env.FRONTEND_ORIGIN}/auth/verify?token=<raw>`

## Session

- After verification, `req.login(user, cb)` is called — same passport session mechanism used by Google OAuth
- No JWT involved; session cookie handles subsequent requests

## User Creation

- On successful verification, calls `usersDao.upsertUser()` with `email_verified: true`
- `display_name` defaults to the email prefix if no name is available
- Existing users (e.g., previously signed in via Google with same email) are updated via the existing ON CONFLICT upsert

## Dependencies

- `resend` — official Resend Node SDK
