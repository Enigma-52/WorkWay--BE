// Deterministic env for every test — set before any app module is imported
// so top-level `process.env.X || 'fallback'` reads in service files see
// these values consistently across the whole run.
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.RESEND_FROM_EMAIL = 'noreply@workway.dev';
process.env.FRONTEND_ORIGIN = 'https://www.workway.dev';
process.env.INTERNAL_API_SECRET = 'test-internal-secret';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.EMAIL_UNSUB_SECRET = 'test-unsub-secret';
