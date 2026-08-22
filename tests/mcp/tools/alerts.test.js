import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/dao/alertsDao.js', () => ({
  alertsDao: { createAlert: vi.fn(), getByUser: vi.fn() },
}));
vi.mock('../../../src/services/companyService.js', () => ({ getCompanyDetails: vi.fn() }));

const { alertsDao } = await import('../../../src/dao/alertsDao.js');
const companyService = await import('../../../src/services/companyService.js');
const { makeFollowCompanyHandler, makeListAlertsHandler } = await import('../../../mcp/tools/alerts.js');

const freeCtx = { user: { id: 7, plan_key: 'free' } };
const proCtx = { user: { id: 7, plan_key: 'pro' } };
const lifetimeCtx = { user: { id: 7, plan_key: 'lifetime' } };

beforeEach(() => {
  vi.clearAllMocks();
  companyService.getCompanyDetails.mockResolvedValue({ name: 'Acme', slug: 'acme', logo_url: null });
  alertsDao.createAlert.mockResolvedValue({ id: 1 });
});

const textOf = (r) => r.content[0].text;

describe('follow_company', () => {
  it('succeeds for a free user — the follow is never plan-gated', async () => {
    const res = await makeFollowCompanyHandler(freeCtx)({ company: 'acme' });
    expect(res.isError).toBeUndefined();
    expect(alertsDao.createAlert).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, companySlug: 'acme' }));
  });

  it('tells a free user that instant email alerts are a Pro feature', async () => {
    const text = textOf(await makeFollowCompanyHandler(freeCtx)({ company: 'acme' }));
    expect(text).toMatch(/Pro/);
    expect(text).toContain('workway.dev/pricing');
  });

  it('gives a Pro user a plain confirmation with no upsell', async () => {
    const text = textOf(await makeFollowCompanyHandler(proCtx)({ company: 'acme' }));
    expect(text).not.toMatch(/upgrade/i);
    expect(text).not.toContain('pricing');
  });

  it('treats lifetime as Pro', async () => {
    const text = textOf(await makeFollowCompanyHandler(lifetimeCtx)({ company: 'acme' }));
    expect(text).not.toContain('pricing');
  });

  it('errors for an unknown company', async () => {
    companyService.getCompanyDetails.mockResolvedValue(null);
    expect((await makeFollowCompanyHandler(freeCtx)({ company: 'ghost' })).isError).toBe(true);
  });

  it('reports an already-followed company without failing', async () => {
    alertsDao.createAlert.mockResolvedValue(null);
    const res = await makeFollowCompanyHandler(proCtx)({ company: 'acme' });
    expect(res.isError).toBeUndefined();
    expect(textOf(res)).toMatch(/already/i);
  });
});

describe('list_alerts', () => {
  it('lists follows for the authenticated user and flags free-plan delivery', async () => {
    alertsDao.getByUser.mockResolvedValue([{ company_slug: 'acme', company_name: 'Acme', created_at: '2026-01-01' }]);
    const payload = JSON.parse(textOf(await makeListAlertsHandler(freeCtx)()));

    expect(alertsDao.getByUser).toHaveBeenCalledWith(7);
    expect(payload.count).toBe(1);
    expect(payload.email_alerts_active).toBe(false);
  });

  it('reports email alerts active for a Pro user', async () => {
    alertsDao.getByUser.mockResolvedValue([]);
    const payload = JSON.parse(textOf(await makeListAlertsHandler(proCtx)()));
    expect(payload.email_alerts_active).toBe(true);
  });
});
