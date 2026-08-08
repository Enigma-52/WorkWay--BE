import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sentEmails, __resetResendMock, __failNextSend } from '../mocks/resend.js';

vi.mock('../../src/dao/magicLinksDao.js', () => ({
  magicLinksDao: { insert: vi.fn(), findByHash: vi.fn(), markUsed: vi.fn(), deleteById: vi.fn() },
}));
vi.mock('../../src/dao/usersDao.js', () => ({
  usersDao: { getByEmail: vi.fn(), upsertUser: vi.fn() },
}));
vi.mock('../../src/services/lifecycleEmailService.js', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(),
}));

const { magicLinksDao } = await import('../../src/dao/magicLinksDao.js');
const { usersDao } = await import('../../src/dao/usersDao.js');
const { sendWelcomeEmail } = await import('../../src/services/lifecycleEmailService.js');
const { sendMagicLink, verifyMagicLink } = await import('../../src/services/magicLinkService.js');

beforeEach(() => {
  __resetResendMock();
  vi.clearAllMocks();
});

describe('sendMagicLink', () => {
  beforeEach(() => {
    magicLinksDao.insert.mockResolvedValue({ id: 1 });
  });

  it('sends an email containing a token-bearing verify link', async () => {
    await sendMagicLink({ email: 'a@gmail.com', ipAddress: '1.2.3.4', userAgent: 'test' });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe('a@gmail.com');
    expect(sentEmails[0].html).toMatch(/\/auth\/verify\?token=[a-f0-9]+/);
  });

  it('embeds a provided callbackUrl in the emailed link', async () => {
    await sendMagicLink({ email: 'a@gmail.com', callbackUrl: '/dashboard/seeker/alerts' });
    expect(sentEmails[0].html).toContain(encodeURIComponent('/dashboard/seeker/alerts'));
  });

  it('omits the callbackUrl param entirely when none is given', async () => {
    await sendMagicLink({ email: 'a@gmail.com' });
    expect(sentEmails[0].html).not.toContain('callbackUrl=');
  });

  it('deletes the token row and throws if the email fails to send', async () => {
    __failNextSend({ message: 'Resend rejected the request' });
    await expect(sendMagicLink({ email: 'a@gmail.com' })).rejects.toThrow('Failed to send magic link email');
    expect(magicLinksDao.deleteById).toHaveBeenCalledWith(1);
  });
});

describe('verifyMagicLink', () => {
  it('rejects an unknown token', async () => {
    magicLinksDao.findByHash.mockResolvedValue(null);
    const result = await verifyMagicLink({ token: 'nope' });
    expect(result).toEqual({ success: false, reason: 'Invalid or unknown token' });
  });

  it('rejects an already-used token', async () => {
    magicLinksDao.findByHash.mockResolvedValue({ id: 1, used_at: new Date(), email: 'a@gmail.com' });
    const result = await verifyMagicLink({ token: 'abc' });
    expect(result).toEqual({ success: false, reason: 'Token has already been used' });
  });

  it('rejects an expired token', async () => {
    magicLinksDao.findByHash.mockResolvedValue({
      id: 1,
      used_at: null,
      expires_at: new Date(Date.now() - 60_000),
      email: 'a@gmail.com',
    });
    const result = await verifyMagicLink({ token: 'abc' });
    expect(result).toEqual({ success: false, reason: 'Token has expired' });
  });

  it('marks a valid token used and returns the upserted user', async () => {
    magicLinksDao.findByHash.mockResolvedValue({
      id: 1,
      used_at: null,
      expires_at: new Date(Date.now() + 60_000),
      email: 'a@gmail.com',
    });
    usersDao.getByEmail.mockResolvedValue(null);
    usersDao.upsertUser.mockResolvedValue({ id: 'u1', email: 'a@gmail.com', is_new: true });

    const result = await verifyMagicLink({ token: 'abc' });

    expect(result.success).toBe(true);
    expect(result.user.id).toBe('u1');
    expect(magicLinksDao.markUsed).toHaveBeenCalledWith(1);
  });

  it('fires the welcome email only for a newly-created user', async () => {
    magicLinksDao.findByHash.mockResolvedValue({
      id: 1,
      used_at: null,
      expires_at: new Date(Date.now() + 60_000),
      email: 'new@gmail.com',
    });
    usersDao.getByEmail.mockResolvedValue(null);
    usersDao.upsertUser.mockResolvedValue({ id: 'u2', email: 'new@gmail.com', is_new: true });

    await verifyMagicLink({ token: 'abc' });

    expect(sendWelcomeEmail).toHaveBeenCalledOnce();
  });

  it('does not fire the welcome email for a returning user', async () => {
    magicLinksDao.findByHash.mockResolvedValue({
      id: 1,
      used_at: null,
      expires_at: new Date(Date.now() + 60_000),
      email: 'returning@gmail.com',
    });
    usersDao.getByEmail.mockResolvedValue({ display_name: 'Returning', first_name: null, last_name: null, avatar_url: null });
    usersDao.upsertUser.mockResolvedValue({ id: 'u3', email: 'returning@gmail.com', is_new: false });

    await verifyMagicLink({ token: 'abc' });

    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });
});
