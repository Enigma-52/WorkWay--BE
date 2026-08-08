import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../src/services/magicLinkService.js', () => ({
  sendMagicLink: vi.fn(),
  verifyMagicLink: vi.fn(),
}));

// A fresh router (and therefore a fresh, un-hit rate limiter) per test, so
// tests can't bleed rate-limit state into each other. Re-imports
// magicLinkService.js too and returns its (fresh, per-reset) mock functions —
// resetModules() invalidates any reference captured before the reset, so the
// mocks a test configures must come from the same import as the router it's
// testing, not a stale top-level one.
async function buildApp() {
  vi.resetModules();
  const authRoutes = (await import('../../src/routes/auth.js')).default;
  const magicLinkService = await import('../../src/services/magicLinkService.js');
  const app = express();
  app.use(express.json());
  // Stand in for passport's req.login(), which the real app wires up via
  // express-session + passport middleware not present in this isolated router test.
  app.use((req, res, next) => {
    req.login = (user, cb) => cb(null);
    next();
  });
  app.use('/api/auth', authRoutes);
  return { app, sendMagicLink: magicLinkService.sendMagicLink, verifyMagicLink: magicLinkService.verifyMagicLink };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/magic-link/send — validation', () => {
  it('400s on a missing email', async () => {
    const { app, sendMagicLink } = await buildApp();
    const res = await request(app).post('/api/auth/magic-link/send').send({});
    expect(res.status).toBe(400);
    expect(sendMagicLink).not.toHaveBeenCalled();
  });

  it('400s on a malformed email', async () => {
    const { app, sendMagicLink } = await buildApp();
    const res = await request(app).post('/api/auth/magic-link/send').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(sendMagicLink).not.toHaveBeenCalled();
  });

  it('400s with a specific message for a disallowed domain', async () => {
    const { app, sendMagicLink } = await buildApp();
    const res = await request(app).post('/api/auth/magic-link/send').send({ email: 'a@some-startup.io' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/personal email/i);
    expect(sendMagicLink).not.toHaveBeenCalled();
  });

  it('accepts an allowed domain, normalizes case, and forwards a sanitized callback_url', async () => {
    const { app, sendMagicLink } = await buildApp();
    sendMagicLink.mockResolvedValue();
    const res = await request(app)
      .post('/api/auth/magic-link/send')
      .send({ email: 'Someone@GMAIL.com', callback_url: '/dashboard/seeker/alerts' });

    expect(res.status).toBe(200);
    expect(sendMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'someone@gmail.com', callbackUrl: '/dashboard/seeker/alerts' })
    );
  });

  it('strips an open-redirect attempt out of callback_url before it ever reaches the email link', async () => {
    const { app, sendMagicLink } = await buildApp();
    sendMagicLink.mockResolvedValue();
    await request(app).post('/api/auth/magic-link/send').send({ email: 'a@gmail.com', callback_url: '//evil.com' });

    expect(sendMagicLink).toHaveBeenCalledWith(expect.objectContaining({ callbackUrl: null }));
  });

  it('also rejects the backslash open-redirect bypass form', async () => {
    const { app, sendMagicLink } = await buildApp();
    sendMagicLink.mockResolvedValue();
    await request(app).post('/api/auth/magic-link/send').send({ email: 'a@gmail.com', callback_url: '/\\evil.com' });

    expect(sendMagicLink).toHaveBeenCalledWith(expect.objectContaining({ callbackUrl: null }));
  });

  it('rejects an absolute URL passed as callback_url', async () => {
    const { app, sendMagicLink } = await buildApp();
    sendMagicLink.mockResolvedValue();
    await request(app)
      .post('/api/auth/magic-link/send')
      .send({ email: 'a@gmail.com', callback_url: 'https://evil.com/phish' });

    expect(sendMagicLink).toHaveBeenCalledWith(expect.objectContaining({ callbackUrl: null }));
  });

  it('500s without leaking internals when the send itself throws', async () => {
    const { app, sendMagicLink } = await buildApp();
    sendMagicLink.mockRejectedValue(new Error('smtp relay unreachable at 10.0.4.2'));
    const res = await request(app).post('/api/auth/magic-link/send').send({ email: 'a@gmail.com' });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('10.0.4.2');
  });
});

describe('POST /api/auth/magic-link/send — rate limiting', () => {
  it('allows 5 requests in the window and rejects the 6th with 429', async () => {
    const { app, sendMagicLink } = await buildApp();
    sendMagicLink.mockResolvedValue();

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/magic-link/send').send({ email: 'a@gmail.com' });
      expect(res.status).toBe(200);
    }

    const sixth = await request(app).post('/api/auth/magic-link/send').send({ email: 'a@gmail.com' });
    expect(sixth.status).toBe(429);
  });
});

describe('GET /api/auth/magic-link/verify', () => {
  it('400s when no token is given', async () => {
    const { app } = await buildApp();
    const res = await request(app).get('/api/auth/magic-link/verify');
    expect(res.status).toBe(400);
  });

  it('400s with the failure reason for an invalid token', async () => {
    const { app, verifyMagicLink } = await buildApp();
    verifyMagicLink.mockResolvedValue({ success: false, reason: 'Token has expired' });
    const res = await request(app).get('/api/auth/magic-link/verify?token=stale');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Token has expired');
  });

  it('logs the user in and returns them on a valid token', async () => {
    const { app, verifyMagicLink } = await buildApp();
    verifyMagicLink.mockResolvedValue({ success: true, user: { id: 'u1', email: 'a@gmail.com' } });
    const res = await request(app).get('/api/auth/magic-link/verify?token=good');
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('u1');
  });
});
