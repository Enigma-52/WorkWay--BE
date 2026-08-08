import { subscriptionsDao } from '../dao/subscriptionsDao.js';
import { plansDao } from '../dao/plansDao.js';
import { usersDao } from '../dao/usersDao.js';
import { logger } from '../utils/logger.js';

async function recomputeAndPersistPlan(userId) {
  const effectivePlan = await subscriptionsDao.computeEffectivePlan(userId);
  await usersDao.setPlanKey(userId, effectivePlan);
  return effectivePlan;
}

export async function grantPlan({ userId, planKey, source = 'admin_grant', externalSubscriptionId = null, expiresAt = null }) {
  const planValid = await plansDao.exists(planKey);
  if (!planValid) throw new Error(`Unknown or inactive plan: ${planKey}`);

  const subscription = await subscriptionsDao.create({ userId, planKey, source, externalSubscriptionId, expiresAt });
  const effectivePlan = await recomputeAndPersistPlan(userId);
  return { subscription, effectivePlan };
}

export async function cancelSubscription({ subscriptionId, userId }) {
  const subscription = await subscriptionsDao.cancel(subscriptionId, userId);
  if (!subscription) return null;

  const effectivePlan = await recomputeAndPersistPlan(userId);
  return { subscription, effectivePlan };
}

// Resolve which WorkWay user a Dodo webhook payload belongs to. Prefer the
// metadata we attached at checkout (survives email changes); fall back to
// matching the customer's email.
async function resolveUserFromDodoPayload(data) {
  const metadataUserId = data?.metadata?.workway_user_id;
  if (metadataUserId) {
    const user = await usersDao.getById(metadataUserId);
    if (user) return user;
  }
  const email = data?.customer?.email;
  if (email) return usersDao.getByEmail(email);
  return null;
}

const ACTIVE_STATUSES = new Set(['subscription.active', 'subscription.renewed']);

// Single entry point for every Dodo webhook event we care about. Returns a
// short result object purely for logging — callers should always 200 the
// webhook regardless (see routes/billing.js), since Dodo retries on non-2xx.
export async function handleDodoWebhookEvent(event) {
  const { type, data } = event;
  const externalSubscriptionId = data?.subscription_id;

  switch (type) {
    case 'subscription.active':
    case 'subscription.renewed': {
      if (!externalSubscriptionId) return { handled: false, reason: 'missing subscription_id' };

      const user = await resolveUserFromDodoPayload(data);
      if (!user) return { handled: false, reason: 'no matching user' };

      const plan = await plansDao.getByDodoProductId(data.product_id);
      if (!plan) return { handled: false, reason: `no plan mapped to product_id ${data.product_id}` };

      await subscriptionsDao.upsertByExternalId({
        userId: user.id,
        planKey: plan.key,
        status: 'active',
        source: 'dodo',
        externalSubscriptionId,
        expiresAt: data.next_billing_date || null,
        metadata: { dodo_customer_id: data?.customer?.customer_id },
      });
      const effectivePlan = await recomputeAndPersistPlan(user.id);
      return { handled: true, userId: user.id, effectivePlan };
    }

    case 'subscription.on_hold': {
      if (!externalSubscriptionId) return { handled: false, reason: 'missing subscription_id' };
      const existing = await subscriptionsDao.getByExternalId(externalSubscriptionId);
      await subscriptionsDao.setStatusByExternalId(externalSubscriptionId, 'on_hold');
      if (existing) {
        const effectivePlan = await recomputeAndPersistPlan(existing.user_id);
        return { handled: true, userId: existing.user_id, effectivePlan };
      }
      return { handled: true, note: 'no local subscription row to update yet' };
    }

    // Terminal per Dodo's docs — the mandate was never created, so there is
    // nothing local to revoke; just log it. Never grant access here.
    case 'subscription.failed': {
      logger.warn('Dodo subscription creation failed', { externalSubscriptionId, data });
      return { handled: true, note: 'terminal failure, no local state to update' };
    }

    case 'subscription.updated': {
      if (!externalSubscriptionId || !data?.status) return { handled: false, reason: 'missing subscription_id or status' };
      const existing = await subscriptionsDao.getByExternalId(externalSubscriptionId);
      if (!existing) return { handled: false, reason: 'no local subscription row' };

      const status = ACTIVE_STATUSES.has(`subscription.${data.status}`) || data.status === 'active' ? 'active' : data.status;
      await subscriptionsDao.setStatusByExternalId(externalSubscriptionId, status);
      const effectivePlan = await recomputeAndPersistPlan(existing.user_id);
      return { handled: true, userId: existing.user_id, effectivePlan };
    }

    default:
      return { handled: false, reason: `unhandled event type: ${type}` };
  }
}
