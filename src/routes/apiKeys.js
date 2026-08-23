import express from 'express';
import rateLimit from 'express-rate-limit';
import { generateApiKey, listApiKeys, revokeApiKey } from '../services/apiKeyService.js';
import { logger } from '../utils/logger.js';
import { requireInternalSecret } from '../utils/internalAuth.js';

const router = express.Router();

// user_id here is client-supplied with no session check of its own — this
// router must only ever be reachable from the session-checked Next.js BFF
// layer, never the browser directly, or user_id becomes guessable IDOR.
router.use(requireInternalSecret);

// Key minting is cheap but unbounded creation would let one account fill the
// table; the read/revoke paths are left unlimited since they are idempotent.
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many keys created. Try again later.' },
});

router.get('/', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  try {
    return res.json({ keys: await listApiKeys(user_id) });
  } catch (err) {
    logger.error('api key list failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to list API keys' });
  }
});

router.post('/', createLimiter, async (req, res) => {
  const { user_id, name, expires_in_days } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  try {
    const { raw, key } = await generateApiKey({
      userId: user_id,
      name,
      expiresInDays: expires_in_days ?? null,
    });
    // raw_key is returned here and never again — the DB only holds its hash.
    return res.status(201).json({ raw_key: raw, key });
  } catch (err) {
    logger.error('api key create failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to create API key' });
  }
});

router.delete('/:id', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  try {
    const revoked = await revokeApiKey({ id: req.params.id, userId: user_id });
    if (!revoked) return res.status(404).json({ error: 'Key not found' });
    return res.json({ success: true });
  } catch (err) {
    logger.error('api key revoke failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;
