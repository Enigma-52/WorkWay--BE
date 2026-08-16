import { usersDao } from '../dao/usersDao.js';
import { logger } from './logger.js';

// `roles` is a jsonb array, e.g. ["seeker"] or ["seeker", "admin"]. The
// column default is ["seeker"] for every new row.
export function hasAdminRole(roles) {
  return Array.isArray(roles) && roles.includes('admin');
}

// Second, independent check on top of `requireInternalSecret`: that header
// only proves a request came from our own Next.js server, not that the
// specific calling user is an admin. Anything state-changing or
// admin-only-in-intent should use both, not the secret alone — a leaked
// internal secret (e.g. from a misconfigured log elsewhere) would otherwise
// let anyone act as an admin against these routes with no further check.
export async function requireAdmin(req, res, next) {
  const userId = req.body?.user_id || req.query?.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id required' });

  try {
    const user = await usersDao.getById(userId);
    if (!user || !hasAdminRole(user.roles)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.adminUser = user;
    next();
  } catch (err) {
    logger.error('admin auth check failed', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
