# Magic Links Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add passwordless magic-link email auth (via Resend) that establishes a passport session on verification, consistent with the existing Google OAuth flow.

**Architecture:** A raw token is generated with `crypto.randomBytes`, sent in email, and only its SHA-256 hash is stored in the `magic_links` table. On verification the token is re-hashed, looked up, validated (not expired, not used), then the user is upserted into `users` and logged in via `req.login()`.

**Tech Stack:** Node.js (ESM), Express 5, Passport, pg (PostgreSQL), Resend SDK, Node built-in `crypto`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/dao/magicLinksDao.js` | Create | Insert & query `magic_links` table |
| `src/services/magicLinkService.js` | Create | Token gen, Resend email, verification logic |
| `src/routes/auth.js` | Modify | Add `POST /magic-link/send` and `GET /magic-link/verify` |
| `package.json` | Modify | Add `resend` dependency |

---

### Task 1: Install Resend SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install resend
```

- [ ] **Step 2: Verify it installed**

```bash
node -e "import('resend').then(m => console.log('resend ok', Object.keys(m)))"
```

Expected output contains `resend ok` and key names like `Resend`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add resend sdk"
```

---

### Task 2: Create `magicLinksDao.js`

**Files:**
- Create: `src/dao/magicLinksDao.js`

- [ ] **Step 1: Create the file**

```js
// src/dao/magicLinksDao.js
import PostgresDao from './dao.js';

const INSERT_MAGIC_LINK_SQL = `
  INSERT INTO magic_links (email, token_hash, expires_at, ip_address, user_agent)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING id
`;

const FIND_BY_HASH_SQL = `
  SELECT id, email, token_hash, expires_at, used_at
  FROM magic_links
  WHERE token_hash = $1
  LIMIT 1
`;

const MARK_USED_SQL = `
  UPDATE magic_links
  SET used_at = now()
  WHERE id = $1
`;

class MagicLinksDao extends PostgresDao {
  constructor() {
    super('magic_links');
  }

  async insert({ email, tokenHash, expiresAt, ipAddress, userAgent }) {
    return this.getQ({
      sql: INSERT_MAGIC_LINK_SQL,
      values: [email, tokenHash, expiresAt, ipAddress ?? null, userAgent ?? null],
      firstResultOnly: true,
    });
  }

  async findByHash(tokenHash) {
    return this.getQ({
      sql: FIND_BY_HASH_SQL,
      values: [tokenHash],
      firstResultOnly: true,
    });
  }

  async markUsed(id) {
    return this.updateQ({
      sql: MARK_USED_SQL,
      values: [id],
    });
  }
}

export const magicLinksDao = new MagicLinksDao();
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --input-type=module < src/dao/magicLinksDao.js 2>&1 || echo "syntax check done"
```

Expected: no error output (the import will fail at runtime without a DB but won't be a syntax error).

- [ ] **Step 3: Commit**

```bash
git add src/dao/magicLinksDao.js
git commit -m "feat: add magicLinksDao"
```

---

### Task 3: Create `magicLinkService.js`

**Files:**
- Create: `src/services/magicLinkService.js`

- [ ] **Step 1: Create the file**

```js
// src/services/magicLinkService.js
import crypto from 'crypto';
import { Resend } from 'resend';
import { magicLinksDao } from '../dao/magicLinksDao.js';
import { usersDao } from '../dao/usersDao.js';
import { logger } from '../utils/logger.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export async function sendMagicLink({ email, ipAddress, userAgent }) {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await magicLinksDao.insert({ email, tokenHash: hash, expiresAt, ipAddress, userAgent });

  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3001';
  const link = `${frontendOrigin}/auth/verify?token=${raw}`;

  const { error } = await resend.emails.send({
    from: 'noreply@workway.dev',
    to: email,
    subject: 'Your WorkWay sign-in link',
    html: `
      <p>Click the link below to sign in to WorkWay. This link expires in 15 minutes and can only be used once.</p>
      <p><a href="${link}">Sign in to WorkWay</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  if (error) {
    logger.error('Resend email failed', { error, email });
    throw new Error('Failed to send magic link email');
  }

  logger.info('Magic link sent', { email });
}

export async function verifyMagicLink({ token }) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const row = await magicLinksDao.findByHash(hash);

  if (!row) {
    return { success: false, reason: 'Invalid or unknown token' };
  }

  if (row.used_at !== null) {
    return { success: false, reason: 'Token has already been used' };
  }

  if (new Date(row.expires_at) < new Date()) {
    return { success: false, reason: 'Token has expired' };
  }

  await magicLinksDao.markUsed(row.id);

  const user = await usersDao.upsertUser({
    email: row.email,
    emailVerified: true,
    displayName: row.email.split('@')[0],
    firstName: null,
    lastName: null,
    avatarUrl: null,
  });

  logger.info('Magic link verified', { email: row.email, userId: user.id });
  return { success: true, user };
}
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --input-type=module < src/services/magicLinkService.js 2>&1 || echo "syntax check done"
```

Expected: no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/magicLinkService.js
git commit -m "feat: add magicLinkService"
```

---

### Task 4: Add routes to `auth.js`

**Files:**
- Modify: `src/routes/auth.js`

- [ ] **Step 1: Replace the file content**

```js
// src/routes/auth.js
import express from 'express';
import passport from 'passport';
import { logger } from '../utils/logger.js';
import { sendMagicLink, verifyMagicLink } from '../services/magicLinkService.js';

const router = express.Router();

// ── Google OAuth ──────────────────────────────────────────────────────────────

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/api/auth/failure' }),
  (req, res) => {
    logger.info('Auth success', { user: req.user });
    res.json({ success: true, user: req.user });
  }
);

router.get('/failure', (req, res) => {
  logger.warn('Auth failure');
  res.status(401).json({ success: false, message: 'Authentication failed' });
});

// ── Magic Links ───────────────────────────────────────────────────────────────

router.post('/magic-link/send', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'A valid email is required' });
  }

  try {
    await sendMagicLink({
      email: email.toLowerCase().trim(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, message: 'Magic link sent — check your email' });
  } catch (err) {
    logger.error('Magic link send failed', { error: err.message, email });
    res.status(500).json({ success: false, message: 'Failed to send magic link' });
  }
});

router.get('/magic-link/verify', async (req, res) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, message: 'Token is required' });
  }

  try {
    const result = await verifyMagicLink({ token });

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.reason });
    }

    await new Promise((resolve, reject) => {
      req.login(result.user, (err) => (err ? reject(err) : resolve()));
    });

    res.json({ success: true, user: result.user });
  } catch (err) {
    logger.error('Magic link verify failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

export default router;
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --input-type=module < src/routes/auth.js 2>&1 || echo "syntax check done"
```

Expected: no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/auth.js
git commit -m "feat: add magic link send and verify routes"
```

---

### Task 5: Manual smoke test

- [ ] **Step 1: Ensure the `magic_links` table exists in your database**

Run this SQL in your Postgres DB if it doesn't exist yet:

```sql
CREATE TABLE IF NOT EXISTS magic_links (
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

- [ ] **Step 2: Start the server**

```bash
npm run dev
```

Expected: server starts on port 3000 without errors.

- [ ] **Step 3: Send a magic link**

```bash
curl -s -X POST http://localhost:3000/api/auth/magic-link/send \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test-email@example.com"}'
```

Expected response:
```json
{"success":true,"message":"Magic link sent — check your email"}
```

Also verify a row appeared in `magic_links`:
```sql
SELECT email, expires_at, used_at FROM magic_links ORDER BY created_at DESC LIMIT 1;
```

- [ ] **Step 4: Verify the magic link**

Copy the raw token from the link in the email, then:

```bash
curl -s "http://localhost:3000/api/auth/magic-link/verify?token=<RAW_TOKEN>"
```

Expected response:
```json
{"success":true,"user":{"id":"...","email":"...","email_verified":true,...}}
```

Verify the row is now marked used:
```sql
SELECT used_at FROM magic_links ORDER BY created_at DESC LIMIT 1;
```

Expected: `used_at` is no longer null.

- [ ] **Step 5: Verify replay protection**

Run the same verify curl again with the same token.

Expected:
```json
{"success":false,"message":"Token has already been used"}
```

- [ ] **Step 6: Commit**

No code changes — this is a verification step only. If any step above failed, fix before committing.
