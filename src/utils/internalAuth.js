// Shared secret between this backend and the Next.js server only (never
// exposed to the browser). Protects endpoints that must only ever be called
// server-to-server: user upsert-on-sign-in, and the admin panel.
const SECRET = process.env.INTERNAL_API_SECRET;

export function requireInternalSecret(req, res, next) {
  if (!SECRET) {
    // Misconfigured deploy — fail closed rather than silently accepting all callers.
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  const provided = req.headers['x-internal-api-secret'];
  if (provided !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
