import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/dao/subscriptionsDao.js', () => ({
  subscriptionsDao: {
    create: vi.fn(),
    cancel: vi.fn(),
    computeEffectivePlan: vi.fn(),
    getByExternalId: vi.fn(),
    upsertByExternalId: vi.fn(),
    setStatusByExternalId: vi.fn(),
  },
}));
vi.mock('../../src/dao/plansDao.js', () => ({
  plansDao: { exists: vi.fn(), getByDodoProductId: vi.fn() },
}));
vi.mock('../../src/dao/usersDao.js', () => ({
  usersDao: { getById: vi.fn(), getByEmail: vi.fn(), setPlanKey: vi.fn() },
}));

const { subscriptionsDao } = await import('../../src/dao/subscriptionsDao.js');
const { plansDao } = await import('../../src/dao/plansDao.js');
const { usersDao } = await import('../../src/dao/usersDao.js');
const { grantPlan, cancelSubscription, handleDodoWebhookEvent } = await import(
  '../../src/services/subscriptionsService.js'
);

beforeEach(() => {
  vi.clearAllMocks();
  usersDao.setPlanKey.mockResolvedValue();
});

describe('grantPlan', () => {
  it('rejects an unknown or inactive plan key', async () => {
    plansDao.exists.mockResolvedValue(false);
    await expect(grantPlan({ userId: 'u1', planKey: 'bogus' })).rejects.toThrow('Unknown or inactive plan: bogus');
    expect(subscriptionsDao.create).not.toHaveBeenCalled();
  });

  it('creates the subscription and recomputes+persists the effective plan', async () => {
    plansDao.exists.mockResolvedValue(true);
    subscriptionsDao.create.mockResolvedValue({ id: 1, plan_key: 'pro' });
    subscriptionsDao.computeEffectivePlan.mockResolvedValue('pro');

    const result = await grantPlan({ userId: 'u1', planKey: 'pro', source: 'admin_grant' });

    expect(result.effectivePlan).toBe('pro');
    expect(usersDao.setPlanKey).toHaveBeenCalledWith('u1', 'pro');
  });
});

describe('cancelSubscription', () => {
  it('returns null without recomputing anything if the subscription was not found/owned', async () => {
    subscriptionsDao.cancel.mockResolvedValue(null);
    const result = await cancelSubscription({ subscriptionId: 999, userId: 'u1' });
    expect(result).toBeNull();
    expect(usersDao.setPlanKey).not.toHaveBeenCalled();
  });

  it('recomputes the effective plan after a successful cancel', async () => {
    subscriptionsDao.cancel.mockResolvedValue({ id: 1, status: 'cancelled' });
    subscriptionsDao.computeEffectivePlan.mockResolvedValue('free');
    const result = await cancelSubscription({ subscriptionId: 1, userId: 'u1' });
    expect(result.effectivePlan).toBe('free');
    expect(usersDao.setPlanKey).toHaveBeenCalledWith('u1', 'free');
  });
});

describe('handleDodoWebhookEvent', () => {
  const activeEvent = (overrides = {}) => ({
    type: 'subscription.active',
    data: {
      subscription_id: 'sub_123',
      product_id: 'pdt_abc',
      customer: { email: 'user@x.com', customer_id: 'cus_1' },
      next_billing_date: '2027-01-01',
      ...overrides,
    },
  });

  it('resolves the user via metadata.workway_user_id first, before falling back to email', async () => {
    usersDao.getById.mockResolvedValue({ id: 'u1', email: 'user@x.com' });
    plansDao.getByDodoProductId.mockResolvedValue({ key: 'pro' });
    subscriptionsDao.upsertByExternalId.mockResolvedValue({});
    subscriptionsDao.computeEffectivePlan.mockResolvedValue('pro');

    const event = activeEvent();
    event.data.metadata = { workway_user_id: 'u1' };

    const result = await handleDodoWebhookEvent(event);

    expect(usersDao.getById).toHaveBeenCalledWith('u1');
    expect(usersDao.getByEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, userId: 'u1', effectivePlan: 'pro' });
  });

  it('falls back to matching by customer email when there is no metadata', async () => {
    usersDao.getByEmail.mockResolvedValue({ id: 'u2', email: 'user@x.com' });
    plansDao.getByDodoProductId.mockResolvedValue({ key: 'pro' });
    subscriptionsDao.upsertByExternalId.mockResolvedValue({});
    subscriptionsDao.computeEffectivePlan.mockResolvedValue('pro');

    const result = await handleDodoWebhookEvent(activeEvent());

    expect(usersDao.getByEmail).toHaveBeenCalledWith('user@x.com');
    expect(result.handled).toBe(true);
  });

  it('does not grant access, and reports unhandled, when no matching user is found', async () => {
    usersDao.getByEmail.mockResolvedValue(null);
    const result = await handleDodoWebhookEvent(activeEvent());
    expect(result).toEqual({ handled: false, reason: 'no matching user' });
    expect(subscriptionsDao.upsertByExternalId).not.toHaveBeenCalled();
  });

  it('does not grant access when the product_id maps to no known plan', async () => {
    usersDao.getByEmail.mockResolvedValue({ id: 'u1' });
    plansDao.getByDodoProductId.mockResolvedValue(null);
    const result = await handleDodoWebhookEvent(activeEvent({ product_id: 'pdt_unknown' }));
    expect(result.handled).toBe(false);
    expect(result.reason).toMatch(/no plan mapped/);
    expect(subscriptionsDao.upsertByExternalId).not.toHaveBeenCalled();
  });

  it('treats subscription.failed as terminal and never grants access', async () => {
    const result = await handleDodoWebhookEvent({
      type: 'subscription.failed',
      data: { subscription_id: 'sub_123' },
    });
    expect(result.handled).toBe(true);
    expect(subscriptionsDao.upsertByExternalId).not.toHaveBeenCalled();
    expect(usersDao.setPlanKey).not.toHaveBeenCalled();
  });

  it('subscription.on_hold updates status only if a local row already exists', async () => {
    subscriptionsDao.getByExternalId.mockResolvedValue(null);
    subscriptionsDao.setStatusByExternalId.mockResolvedValue(null);
    const result = await handleDodoWebhookEvent({ type: 'subscription.on_hold', data: { subscription_id: 'sub_1' } });
    expect(result.note).toMatch(/no local subscription row/);
    expect(usersDao.setPlanKey).not.toHaveBeenCalled();
  });

  it('subscription.on_hold recomputes plan when a local row exists', async () => {
    subscriptionsDao.getByExternalId.mockResolvedValue({ user_id: 'u1' });
    subscriptionsDao.setStatusByExternalId.mockResolvedValue({});
    subscriptionsDao.computeEffectivePlan.mockResolvedValue('free');
    const result = await handleDodoWebhookEvent({ type: 'subscription.on_hold', data: { subscription_id: 'sub_1' } });
    expect(result.effectivePlan).toBe('free');
    expect(usersDao.setPlanKey).toHaveBeenCalledWith('u1', 'free');
  });

  it('subscription.updated is a no-op (not an error) when there is no local row yet', async () => {
    subscriptionsDao.getByExternalId.mockResolvedValue(null);
    const result = await handleDodoWebhookEvent({
      type: 'subscription.updated',
      data: { subscription_id: 'sub_1', status: 'active' },
    });
    expect(result).toEqual({ handled: false, reason: 'no local subscription row' });
  });

  it('an unrecognized event type is reported as unhandled, not thrown', async () => {
    const result = await handleDodoWebhookEvent({ type: 'something.new', data: {} });
    expect(result.handled).toBe(false);
    expect(result.reason).toContain('something.new');
  });
});
