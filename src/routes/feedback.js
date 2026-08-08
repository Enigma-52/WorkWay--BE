import express from 'express';
import { isIP } from 'node:net';
import rateLimit from 'express-rate-limit';
import { runPgStatement } from '../dao/dao.js';

const router = express.Router();

const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' },
});

const ALLOWED_ROLES = new Set(['candidate', 'hiring', 'other', 'unknown']);
const ALLOWED_CATEGORIES = new Set(['bug', 'feature', 'data-issue', 'ux', 'other']);

function normalizeOptionalText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRole(value) {
  const role = normalizeOptionalText(value);
  if (!role || !ALLOWED_ROLES.has(role)) return 'unknown';
  return role;
}

function normalizeCategory(value) {
  const category = normalizeOptionalText(value);
  if (!category || !ALLOWED_CATEGORIES.has(category)) return 'other';
  return category;
}

function normalizeRating(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return null;
  return parsed;
}

// req.ip is Express's trust-proxy-aware resolved client IP, not the raw
// (client-spoofable) X-Forwarded-For header.
function normalizeIpAddress(req) {
  let candidate = typeof req.ip === 'string' ? req.ip.trim() : '';

  if (candidate.startsWith('::ffff:')) {
    candidate = candidate.slice(7);
  }

  return isIP(candidate) ? candidate : null;
}

router.post('/', feedbackLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const message = normalizeOptionalText(body.message);

    if (!message) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Feedback message is required.',
      });
    }

    const name = normalizeOptionalText(body.name);
    const email = normalizeOptionalText(body.email);
    const role = normalizeRole(body.role);
    const category = normalizeCategory(body.category);
    const rating = normalizeRating(body.rating);
    const userAgent = normalizeOptionalText(req.headers['user-agent']);
    const ipAddress = normalizeIpAddress(req);
    const metadata =
      body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata
        : {};

    const [row] = await runPgStatement({
      query: `
        INSERT INTO feedback (
          name,
          email,
          role,
          category,
          rating,
          message,
          user_agent,
          ip_address,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        RETURNING id, created_at
      `,
      values: [
        name,
        email,
        role,
        category,
        rating,
        message,
        userAgent,
        ipAddress,
        JSON.stringify(metadata),
      ],
    });

    return res.status(201).json({
      success: true,
      id: row?.id ?? null,
      created_at: row?.created_at ?? null,
    });
  } catch (err) {
    console.error('POST /api/feedback error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err?.message ?? 'Failed to submit feedback',
    });
  }
});

export default router;
