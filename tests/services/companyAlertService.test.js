import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sentEmails, __resetResendMock, __failNextSend } from '../mocks/resend.js';

vi.mock('../../src/dao/alertCheckpointDao.js', () => ({
  alertCheckpointDao: { get: vi.fn(), advance: vi.fn() },
}));
vi.mock('../../src/dao/jobsDao.js', () => ({
  jobsDao: { getNewJobsSince: vi.fn() },
}));
vi.mock('../../src/dao/alertsDao.js', () => ({
  alertsDao: { getFollowersForCompanySlugs: vi.fn() },
}));
vi.mock('../../src/dao/featureFlagsDao.js', () => ({
  featureFlagsDao: { isEnabled: vi.fn() },
}));
vi.mock('../../src/dao/emailLogDao.js', () => ({
  emailLogDao: { hasSent: vi.fn(), log: vi.fn() },
}));

const { alertCheckpointDao } = await import('../../src/dao/alertCheckpointDao.js');
const { jobsDao } = await import('../../src/dao/jobsDao.js');
const { alertsDao } = await import('../../src/dao/alertsDao.js');
const { featureFlagsDao } = await import('../../src/dao/featureFlagsDao.js');
const { emailLogDao } = await import('../../src/dao/emailLogDao.js');
const { runCompanyAlertCheckCron, sendTestCompanyAlertEmail } = await import(
  '../../src/services/companyAlertService.js'
);

function job(id, slug, title, companySlug, companyName, location = 'Remote') {
  return { id, slug, title, location, employment_type: 'Full-Time', company_slug: companySlug, company_name: companyName };
}

function follower(userId, companySlug, companyName, overrides = {}) {
  return {
    user_id: userId,
    company_slug: companySlug,
    company_name: companyName,
    email: `${userId}@x.com`,
    display_name: userId,
    plan_key: 'pro',
    emails_opted_out: false,
    ...overrides,
  };
}

beforeEach(() => {
  __resetResendMock();
  vi.clearAllMocks();
  alertCheckpointDao.get.mockResolvedValue(100);
  alertCheckpointDao.advance.mockResolvedValue();
  featureFlagsDao.isEnabled.mockResolvedValue(true);
  emailLogDao.hasSent.mockResolvedValue(false);
  emailLogDao.log.mockResolvedValue();
});

describe('runCompanyAlertCheckCron — no-op paths', () => {
  it('is a clean no-op when there are no new jobs', async () => {
    jobsDao.getNewJobsSince.mockResolvedValue([]);
    const result = await runCompanyAlertCheckCron();
    expect(result).toEqual({ checked: 0, matchedCompanies: 0, sent: 0 });
    expect(alertCheckpointDao.advance).not.toHaveBeenCalled();
    expect(sentEmails).toHaveLength(0);
  });

  it('advances the checkpoint even when new jobs have no company_slug', async () => {
    jobsDao.getNewJobsSince.mockResolvedValue([{ id: 105, slug: 'x', title: 'X', company_slug: null }]);
    const result = await runCompanyAlertCheckCron();
    expect(result.matchedCompanies).toBe(0);
    expect(alertCheckpointDao.advance).toHaveBeenCalledWith(105);
    expect(sentEmails).toHaveLength(0);
  });
});

describe('runCompanyAlertCheckCron — matching and gating', () => {
  it('sends exactly one digest email per user, even when they follow multiple matched companies', async () => {
    jobsDao.getNewJobsSince.mockResolvedValue([
      job(101, 'acme-eng', 'Engineer', 'acme', 'Acme'),
      job(102, 'globex-pm', 'PM', 'globex', 'Globex'),
    ]);
    alertsDao.getFollowersForCompanySlugs.mockResolvedValue([
      follower('pro-user', 'acme', 'Acme'),
      follower('pro-user', 'globex', 'Globex'),
    ]);

    const result = await runCompanyAlertCheckCron();

    expect(result.sent).toBe(1);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe('pro-user@x.com');
    // Both companies' jobs must be in that single email.
    expect(sentEmails[0].html).toContain('Acme');
    expect(sentEmails[0].html).toContain('Globex');
    expect(alertCheckpointDao.advance).toHaveBeenCalledWith(102);
  });

  it('skips a free-plan follower and counts it as skippedNotPro', async () => {
    jobsDao.getNewJobsSince.mockResolvedValue([job(101, 'acme-eng', 'Engineer', 'acme', 'Acme')]);
    alertsDao.getFollowersForCompanySlugs.mockResolvedValue([follower('free-user', 'acme', 'Acme', { plan_key: 'free' })]);

    const result = await runCompanyAlertCheckCron();

    expect(result.sent).toBe(0);
    expect(result.skippedNotPro).toBe(1);
    expect(sentEmails).toHaveLength(0);
  });

  it('skips an opted-out follower and counts it as skippedOptedOut, even if they are Pro', async () => {
    jobsDao.getNewJobsSince.mockResolvedValue([job(101, 'acme-eng', 'Engineer', 'acme', 'Acme')]);
    alertsDao.getFollowersForCompanySlugs.mockResolvedValue([
      follower('opted-out', 'acme', 'Acme', { emails_opted_out: true }),
    ]);

    const result = await runCompanyAlertCheckCron();

    expect(result.sent).toBe(0);
    expect(result.skippedOptedOut).toBe(1);
    expect(sentEmails).toHaveLength(0);
  });

  it('never emails a non-follower, even if they follow an unrelated company', async () => {
    jobsDao.getNewJobsSince.mockResolvedValue([job(101, 'acme-eng', 'Engineer', 'acme', 'Acme')]);
    alertsDao.getFollowersForCompanySlugs.mockResolvedValue([follower('someone', 'other-company', 'Other')]);

    const result = await runCompanyAlertCheckCron();

    expect(result.sent).toBe(0);
    expect(sentEmails).toHaveLength(0);
  });

  it('still advances the checkpoint and counts matches when the feature flag is off, but sends nothing', async () => {
    featureFlagsDao.isEnabled.mockResolvedValue(false);
    jobsDao.getNewJobsSince.mockResolvedValue([job(101, 'acme-eng', 'Engineer', 'acme', 'Acme')]);
    alertsDao.getFollowersForCompanySlugs.mockResolvedValue([follower('pro-user', 'acme', 'Acme')]);

    const result = await runCompanyAlertCheckCron();

    expect(result.flagOn).toBe(false);
    expect(result.sent).toBe(0);
    expect(sentEmails).toHaveLength(0);
    // The flag being off must never block the checkpoint from advancing —
    // otherwise flipping it on later would flood everyone matched while it
    // was off.
    expect(alertCheckpointDao.advance).toHaveBeenCalledWith(101);
  });

  it('never re-emails a job the user was already sent (per-job dedup)', async () => {
    jobsDao.getNewJobsSince.mockResolvedValue([job(101, 'acme-eng', 'Engineer', 'acme', 'Acme')]);
    alertsDao.getFollowersForCompanySlugs.mockResolvedValue([follower('pro-user', 'acme', 'Acme')]);
    emailLogDao.hasSent.mockResolvedValue(true); // already sent this exact job to this exact user

    const result = await runCompanyAlertCheckCron();

    expect(result.sent).toBe(0);
    expect(sentEmails).toHaveLength(0);
  });

  it('sends a partial digest when only some of a batch is unseen (mixed dedup)', async () => {
    jobsDao.getNewJobsSince.mockResolvedValue([
      job(101, 'acme-eng', 'Engineer', 'acme', 'Acme'),
      job(102, 'acme-pm', 'PM', 'acme', 'Acme'),
    ]);
    alertsDao.getFollowersForCompanySlugs.mockResolvedValue([follower('pro-user', 'acme', 'Acme')]);
    emailLogDao.hasSent.mockImplementation(async ({ referenceId }) => referenceId === '101');

    const result = await runCompanyAlertCheckCron();

    expect(result.sent).toBe(1);
    expect(sentEmails[0].html).toContain('PM');
    expect(sentEmails[0].html).not.toContain('>Engineer<');
    // Only the unseen job gets logged — the already-sent one is left alone.
    expect(emailLogDao.log).toHaveBeenCalledTimes(1);
    expect(emailLogDao.log).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'pro-user', referenceId: '102' })
    );
  });

  it('does not let one user’s send failure block another user’s email or the checkpoint advance', async () => {
    jobsDao.getNewJobsSince.mockResolvedValue([
      job(101, 'acme-eng', 'Engineer', 'acme', 'Acme'),
      job(102, 'globex-pm', 'PM', 'globex', 'Globex'),
    ]);
    alertsDao.getFollowersForCompanySlugs.mockResolvedValue([
      follower('user-a', 'acme', 'Acme'),
      follower('user-b', 'globex', 'Globex'),
    ]);
    // user-a's send throws; user-b's should still go through.
    __failNextSend({ message: 'simulated Resend outage' });

    const result = await runCompanyAlertCheckCron();

    expect(result.sent).toBe(1); // only user-b succeeded
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe('user-b@x.com');
    expect(alertCheckpointDao.advance).toHaveBeenCalledWith(102);
  });
});

describe('sendTestCompanyAlertEmail', () => {
  it('sends synthetic data to the admin’s own address and logs it as a test send', async () => {
    const admin = { id: 'admin-1', email: 'admin@workway.dev', display_name: 'Admin' };
    await sendTestCompanyAlertEmail(admin);

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe('admin@workway.dev');
    expect(sentEmails[0].html).toContain('sample');
    expect(emailLogDao.log).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-1', emailType: 'company_alert', isTest: true })
    );
  });

  it('never touches real follower or job data', async () => {
    const admin = { id: 'admin-1', email: 'admin@workway.dev', display_name: 'Admin' };
    await sendTestCompanyAlertEmail(admin);
    expect(alertsDao.getFollowersForCompanySlugs).not.toHaveBeenCalled();
    expect(jobsDao.getNewJobsSince).not.toHaveBeenCalled();
  });
});
